import { getDatabase, initDatabase } from '../../../../shared/infrastructure/database/connection';
import type {
  ChunkDocumentProgress,
  ChunkDocumentProgressRepository,
} from '../../domain/repositories/ChunkDocumentProgressRepository';

export class DrizzleChunkDocumentProgressRepository implements ChunkDocumentProgressRepository {
  private initialized = false;

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    await initDatabase();
    this.initialized = true;
  }

  private mapRow(row: any): ChunkDocumentProgress {
    return {
      documentId: row.document_id,
      documentVersion: Number(row.document_version),
      processingScope: row.processing_scope,
      completedUnitIds: JSON.parse(row.completed_unit_ids || '[]'),
      selectedStrategy: row.selected_strategy ?? undefined,
      fallbackEvents: JSON.parse(row.fallback_events || '[]'),
      failures: JSON.parse(row.failures || '[]'),
      updatedAt: Number(row.updated_at),
    };
  }

  private async upsert(progress: ChunkDocumentProgress): Promise<void> {
    await this.ensureInitialized();
    const { db } = getDatabase();
    await db.executeSql(
      `INSERT OR REPLACE INTO chunk_document_progress (
        document_id, document_version, processing_scope, completed_unit_ids,
        selected_strategy, fallback_events, failures, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        progress.documentId,
        progress.documentVersion,
        progress.processingScope,
        JSON.stringify(progress.completedUnitIds),
        progress.selectedStrategy ?? null,
        JSON.stringify(progress.fallbackEvents),
        JSON.stringify(progress.failures),
        progress.updatedAt,
      ],
    );
  }

  async load(documentId: string, documentVersion: number, processingScope: string): Promise<ChunkDocumentProgress | null> {
    await this.ensureInitialized();
    const { db } = getDatabase();
    const [result] = await db.executeSql(
      `SELECT * FROM chunk_document_progress
       WHERE document_id = ? AND document_version = ? AND processing_scope = ? LIMIT 1`,
      [documentId, documentVersion, processingScope],
    );
    return result.rows.length > 0 ? this.mapRow(result.rows.item(0)) : null;
  }

  async saveUnitCompleted(progress: ChunkDocumentProgress, unitId: string): Promise<void> {
    if (!progress.completedUnitIds.includes(unitId)) progress.completedUnitIds.push(unitId);
    progress.updatedAt = Date.now();
    await this.upsert(progress);
  }

  async recordFailure(progress: ChunkDocumentProgress, failure: ChunkDocumentProgress['failures'][number]): Promise<void> {
    progress.failures.push(failure);
    progress.updatedAt = Date.now();
    await this.upsert(progress);
  }

  async recordFallback(progress: ChunkDocumentProgress, fallback: ChunkDocumentProgress['fallbackEvents'][number]): Promise<void> {
    progress.fallbackEvents.push(fallback);
    progress.updatedAt = Date.now();
    await this.upsert(progress);
  }
}