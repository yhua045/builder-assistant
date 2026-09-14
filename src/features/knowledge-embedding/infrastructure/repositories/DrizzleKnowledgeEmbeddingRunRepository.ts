import { getDatabase, initDatabase } from '../../../../shared/infrastructure/database/connection.ts';
import type { DocumentChunkingWorkflowRecord } from '../../../../shared/domain/repositories/DocumentChunkingWorkflowRepository.ts';
import type { KnowledgeEmbeddingRun, KnowledgeEmbeddingRunStatus } from '../../domain/entities/KnowledgeEmbeddingRun.ts';
import type { KnowledgeEmbeddingRunRepository } from '../../domain/repositories/KnowledgeEmbeddingRunRepository.ts';

export class DrizzleKnowledgeEmbeddingRunRepository implements KnowledgeEmbeddingRunRepository {
  private initialized = false;

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    await initDatabase();
    this.initialized = true;
  }

  private mapRow(row: any): DocumentChunkingWorkflowRecord {
    return {
      id: row.id,
      documentId: row.document_id,
      documentVersion: Number(row.document_version ?? 1),
      projectId: row.project_id ?? undefined,
      status: row.status,
      workflowState: row.workflow_state,
      checkpointId: row.checkpoint_id ?? undefined,
      lastEvent: row.last_event ?? undefined,
      retryCount: Number(row.retry_count ?? 0),
      circuitOpen: Boolean(row.circuit_open),
      supportedForAnalysis: row.supported_for_analysis === null || row.supported_for_analysis === undefined
        ? undefined
        : Boolean(row.supported_for_analysis),
      validationReason: row.validation_reason ?? undefined,
      isAlreadyAnalyzed: Boolean(row.is_already_analyzed),
      resumeFromCheckpoint: Boolean(row.resume_from_checkpoint),
      createdAt: Number(row.created_at ?? 0),
      updatedAt: Number(row.updated_at ?? 0),
    };
  }

  private toRun(record: DocumentChunkingWorkflowRecord): KnowledgeEmbeddingRun {
    return {
      id: record.id,
      documentId: record.documentId,
      status: record.status as KnowledgeEmbeddingRunStatus,
      currentStage: record.workflowState === 'completed' ? 'indexing' : record.workflowState as KnowledgeEmbeddingRun['currentStage'],
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
    };
  }

  async upsert(record: DocumentChunkingWorkflowRecord): Promise<void> {
    await this.ensureInitialized();
    const { db } = getDatabase();
    const existing = await this.findByDocumentVersion(record.documentId, record.documentVersion);
    const now = Date.now();
    const payload = {
      ...record,
      createdAt: record.createdAt || now,
      updatedAt: now,
      retryCount: record.retryCount ?? 0,
    };

    if (existing) {
      await db.executeSql(
        `UPDATE knowledge_embedding_runs SET project_id = ?, status = ?, workflow_state = ?, checkpoint_id = ?, last_event = ?, retry_count = ?, circuit_open = ?, supported_for_analysis = ?, validation_reason = ?, is_already_analyzed = ?, resume_from_checkpoint = ?, updated_at = ? WHERE id = ?`,
        [payload.projectId ?? null, payload.status, payload.workflowState, payload.checkpointId ?? null, payload.lastEvent ?? null, payload.retryCount, payload.circuitOpen ? 1 : 0, payload.supportedForAnalysis === undefined ? null : payload.supportedForAnalysis ? 1 : 0, payload.validationReason ?? null, payload.isAlreadyAnalyzed ? 1 : 0, payload.resumeFromCheckpoint ? 1 : 0, payload.updatedAt, payload.id],
      );
      return;
    }

    await db.executeSql(
      `INSERT INTO knowledge_embedding_runs (id, document_id, document_version, project_id, status, workflow_state, checkpoint_id, last_event, retry_count, circuit_open, supported_for_analysis, validation_reason, is_already_analyzed, resume_from_checkpoint, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [payload.id, payload.documentId, payload.documentVersion, payload.projectId ?? null, payload.status, payload.workflowState, payload.checkpointId ?? null, payload.lastEvent ?? null, payload.retryCount, payload.circuitOpen ? 1 : 0, payload.supportedForAnalysis === undefined ? null : payload.supportedForAnalysis ? 1 : 0, payload.validationReason ?? null, payload.isAlreadyAnalyzed ? 1 : 0, payload.resumeFromCheckpoint ? 1 : 0, payload.createdAt, payload.updatedAt],
    );
  }

  async findByDocumentVersion(documentId: string, version: number): Promise<DocumentChunkingWorkflowRecord | null> {
    await this.ensureInitialized();
    const { db } = getDatabase();
    const [result] = await db.executeSql('SELECT * FROM knowledge_embedding_runs WHERE document_id = ? AND document_version = ? ORDER BY updated_at DESC LIMIT 1', [documentId, version]);
    return result.rows.length === 0 ? null : this.mapRow(result.rows.item(0));
  }

  async findLatestByDocumentId(documentId: string): Promise<DocumentChunkingWorkflowRecord | null> {
    await this.ensureInitialized();
    const { db } = getDatabase();
    const [result] = await db.executeSql('SELECT * FROM knowledge_embedding_runs WHERE document_id = ? ORDER BY document_version DESC, updated_at DESC LIMIT 1', [documentId]);
    return result.rows.length === 0 ? null : this.mapRow(result.rows.item(0));
  }

  async findWorkflowByStatus(status: string): Promise<DocumentChunkingWorkflowRecord[]> {
    await this.ensureInitialized();
    const { db } = getDatabase();
    const [result] = await db.executeSql('SELECT * FROM knowledge_embedding_runs WHERE status = ? ORDER BY updated_at DESC', [status]);
    const records: DocumentChunkingWorkflowRecord[] = [];
    for (let index = 0; index < result.rows.length; index += 1) records.push(this.mapRow(result.rows.item(index)));
    return records;
  }

  async create(run: KnowledgeEmbeddingRun): Promise<KnowledgeEmbeddingRun> {
    const record: DocumentChunkingWorkflowRecord = {
      id: run.id,
      documentId: run.documentId,
      documentVersion: 1,
      status: run.status,
      workflowState: run.currentStage ?? 'parsing',
      retryCount: 0,
      circuitOpen: false,
      createdAt: run.createdAt.getTime(),
      updatedAt: (run.updatedAt ?? run.createdAt).getTime(),
    };
    await this.upsert(record);
    return run;
  }

  async findByDocumentId(documentId: string): Promise<KnowledgeEmbeddingRun | null> {
    const record = await this.findLatestByDocumentId(documentId);
    return record ? this.toRun(record) : null;
  }

  async findById(id: string): Promise<KnowledgeEmbeddingRun | null> {
    await this.ensureInitialized();
    const { db } = getDatabase();
    const [result] = await db.executeSql('SELECT * FROM knowledge_embedding_runs WHERE id = ? LIMIT 1', [id]);
    return result.rows.length === 0 ? null : this.toRun(this.mapRow(result.rows.item(0)));
  }

  async findByStatus(status: KnowledgeEmbeddingRunStatus): Promise<KnowledgeEmbeddingRun[]> {
    const records = await this.findWorkflowByStatus(status);
    return records.map(record => this.toRun(record));
  }

  async update(id: string, patch: Partial<KnowledgeEmbeddingRun>): Promise<KnowledgeEmbeddingRun> {
    const current = await this.findById(id);
    if (!current) throw new Error('Knowledge embedding run not found');
    const next = { ...current, ...patch, updatedAt: patch.updatedAt ?? new Date() };
    const record = await this.findByDocumentVersion(next.documentId, 1);
    if (!record) throw new Error('Knowledge embedding workflow not found');
    await this.upsert({ ...record, status: next.status, workflowState: next.currentStage ?? record.workflowState, updatedAt: next.updatedAt.getTime() });
    return next;
  }
}