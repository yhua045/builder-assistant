import { getDatabase, initDatabase } from '../database/connection.ts';
import {
  DocumentChunkingWorkflowRecord,
  DocumentChunkingWorkflowRepository,
} from '../../../shared/domain/repositories/DocumentChunkingWorkflowRepository.ts';

export class DrizzleDocumentChunkingWorkflowRepository implements DocumentChunkingWorkflowRepository {
  private initialized = false;

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    await initDatabase();
    this.initialized = true;
  }

  private mapRowToRecord(row: any): DocumentChunkingWorkflowRecord {
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
      supportedForAnalysis: row.supported_for_analysis === 1 || row.supported_for_analysis === true ? true : row.supported_for_analysis === 0 || row.supported_for_analysis === false ? false : undefined,
      validationReason: row.validation_reason ?? undefined,
      isAlreadyAnalyzed: row.is_already_analyzed === 1 || row.is_already_analyzed === true,
      resumeFromCheckpoint: row.resume_from_checkpoint === 1 || row.resume_from_checkpoint === true,
      createdAt: Number(row.created_at ?? 0),
      updatedAt: Number(row.updated_at ?? 0),
    };
  }

  async upsert(record: DocumentChunkingWorkflowRecord): Promise<void> {
    await this.ensureInitialized();
    const { db } = getDatabase();

    const existing = await this.findByDocumentVersion(record.documentId, record.documentVersion);
    const timestamp = Date.now();
    const payload = {
      ...record,
      updatedAt: timestamp,
      createdAt: record.createdAt || timestamp,
      retryCount: record.retryCount ?? 0,
      circuitOpen: Boolean(record.circuitOpen),
      supportedForAnalysis: record.supportedForAnalysis,
      validationReason: record.validationReason ?? null,
      isAlreadyAnalyzed: Boolean(record.isAlreadyAnalyzed),
      resumeFromCheckpoint: Boolean(record.resumeFromCheckpoint),
    };

    if (existing) {
      await db.executeSql(
        `UPDATE document_chunking_workflows SET
          project_id = ?,
          status = ?,
          workflow_state = ?,
          checkpoint_id = ?,
          last_event = ?,
          retry_count = ?,
          circuit_open = ?,
          supported_for_analysis = ?,
          validation_reason = ?,
          is_already_analyzed = ?,
          resume_from_checkpoint = ?,
          updated_at = ?
        WHERE id = ?`,
        [
          payload.projectId ?? null,
          payload.status,
          payload.workflowState,
          payload.checkpointId ?? null,
          payload.lastEvent ?? null,
          payload.retryCount,
          payload.circuitOpen ? 1 : 0,
          payload.supportedForAnalysis === undefined ? null : payload.supportedForAnalysis ? 1 : 0,
          payload.validationReason ?? null,
          payload.isAlreadyAnalyzed ? 1 : 0,
          payload.resumeFromCheckpoint ? 1 : 0,
          payload.updatedAt,
          payload.id,
        ],
      );
      return;
    }

    await db.executeSql(
      `INSERT INTO document_chunking_workflows (
        id,
        document_id,
        document_version,
        project_id,
        status,
        workflow_state,
        checkpoint_id,
        last_event,
        retry_count,
        circuit_open,
        supported_for_analysis,
        validation_reason,
        is_already_analyzed,
        resume_from_checkpoint,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.id,
        payload.documentId,
        payload.documentVersion,
        payload.projectId ?? null,
        payload.status,
        payload.workflowState,
        payload.checkpointId ?? null,
        payload.lastEvent ?? null,
        payload.retryCount,
        payload.circuitOpen ? 1 : 0,
        payload.supportedForAnalysis === undefined ? null : payload.supportedForAnalysis ? 1 : 0,
        payload.validationReason ?? null,
        payload.isAlreadyAnalyzed ? 1 : 0,
        payload.resumeFromCheckpoint ? 1 : 0,
        payload.createdAt,
        payload.updatedAt,
      ],
    );
  }

  async findByDocumentVersion(documentId: string, version: number): Promise<DocumentChunkingWorkflowRecord | null> {
    await this.ensureInitialized();
    const { db } = getDatabase();
    const [result] = await db.executeSql(
      'SELECT * FROM document_chunking_workflows WHERE document_id = ? AND document_version = ? ORDER BY updated_at DESC LIMIT 1',
      [documentId, version],
    );

    if (result.rows.length === 0) return null;
    return this.mapRowToRecord(result.rows.item(0));
  }

  async findLatestByDocumentId(documentId: string): Promise<DocumentChunkingWorkflowRecord | null> {
    await this.ensureInitialized();
    const { db } = getDatabase();
    const [result] = await db.executeSql(
      'SELECT * FROM document_chunking_workflows WHERE document_id = ? ORDER BY document_version DESC, updated_at DESC LIMIT 1',
      [documentId],
    );

    if (result.rows.length === 0) return null;
    return this.mapRowToRecord(result.rows.item(0));
  }

  async findByStatus(status: string): Promise<DocumentChunkingWorkflowRecord[]> {
    await this.ensureInitialized();
    const { db } = getDatabase();
    const [result] = await db.executeSql(
      'SELECT * FROM document_chunking_workflows WHERE status = ? ORDER BY updated_at DESC',
      [status],
    );

    const records: DocumentChunkingWorkflowRecord[] = [];
    for (let i = 0; i < result.rows.length; i++) {
      records.push(this.mapRowToRecord(result.rows.item(i)));
    }
    return records;
  }
}
