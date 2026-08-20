import { getDatabase, initDatabase } from '../database/connection.ts';
import { KnowledgeChunk } from '../../../shared/domain/entities/KnowledgeChunk.ts';

export interface ChunkRepository {
  save(chunk: KnowledgeChunk): Promise<void>;
  saveMany(chunks: KnowledgeChunk[]): Promise<void>;
  findById(id: string): Promise<KnowledgeChunk | null>;
  findByDocumentId(documentId: string): Promise<KnowledgeChunk[]>;
  findByDocumentVersion(documentId: string, version: number): Promise<KnowledgeChunk[]>;
  markSuperseded(oldChunkIds: string[], newerChunkId: string, supersededAt: Date): Promise<void>;
  delete(id: string): Promise<void>;
}

export class DrizzleChunkRepository implements ChunkRepository {
  private initialized = false;

  private async ensureInitialized() {
    if (this.initialized) return;
    await initDatabase();
    this.initialized = true;
  }

  private mapRowToChunk(row: any): KnowledgeChunk {
    return {
      id: row.id,
      documentId: row.document_id,
      documentVersion: row.document_version ?? 1,
      projectId: row.project_id ?? undefined,
      content: row.content,
      chunkIndex: row.chunk_index,
      tokenCount: row.token_count ?? undefined,
      wordCount: row.word_count ?? undefined,
      charCount: row.char_count ?? undefined,
      startOffset: row.start_offset ?? undefined,
      endOffset: row.end_offset ?? undefined,
      isOutdated: row.is_outdated === 1 || row.is_outdated === true || false,
      isSuperseded: row.is_superseded === 1 || row.is_superseded === true || false,
      supersededByChunkId: row.superseded_by_chunk_id ?? undefined,
      supersededAt: row.superseded_at ? new Date(Number(row.superseded_at)) : undefined,
      createdAt: row.created_at ? new Date(Number(row.created_at)) : undefined,
      updatedAt: row.updated_at ? new Date(Number(row.updated_at)) : undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
  }

  async save(chunk: KnowledgeChunk): Promise<void> {
    await this.ensureInitialized();
    const { db } = getDatabase();
    const now = Date.now();
    const payload = {
      ...chunk,
      documentVersion: chunk.documentVersion ?? 1,
      projectId: chunk.projectId ?? null,
      tokenCount: chunk.tokenCount ?? null,
      wordCount: chunk.wordCount ?? null,
      charCount: chunk.charCount ?? null,
      startOffset: chunk.startOffset ?? null,
      endOffset: chunk.endOffset ?? null,
      isOutdated: Boolean(chunk.isOutdated),
      isSuperseded: Boolean(chunk.isSuperseded),
      supersededByChunkId: chunk.supersededByChunkId ?? null,
      supersededAt: chunk.supersededAt ? chunk.supersededAt.getTime() : null,
      metadata: chunk.metadata ? JSON.stringify(chunk.metadata) : null,
      createdAt: chunk.createdAt ? chunk.createdAt.getTime() : now,
      updatedAt: chunk.updatedAt ? chunk.updatedAt.getTime() : now,
    };

    const existing = await this.findById(chunk.id);
    if (existing) {
      await db.executeSql(
        `UPDATE knowledge_chunks SET
          document_id = ?,
          document_version = ?,
          project_id = ?,
          content = ?,
          chunk_index = ?,
          token_count = ?,
          word_count = ?,
          char_count = ?,
          start_offset = ?,
          end_offset = ?,
          is_outdated = ?,
          is_superseded = ?,
          superseded_by_chunk_id = ?,
          superseded_at = ?,
          metadata = ?,
          updated_at = ?
        WHERE id = ?`,
        [
          payload.documentId,
          payload.documentVersion,
          payload.projectId,
          payload.content,
          payload.chunkIndex,
          payload.tokenCount,
          payload.wordCount,
          payload.charCount,
          payload.startOffset,
          payload.endOffset,
          payload.isOutdated ? 1 : 0,
          payload.isSuperseded ? 1 : 0,
          payload.supersededByChunkId,
          payload.supersededAt,
          payload.metadata,
          payload.updatedAt,
          payload.id,
        ],
      );
      return;
    }

    await db.executeSql(
      `INSERT INTO knowledge_chunks (
        id,
        document_id,
        document_version,
        project_id,
        content,
        chunk_index,
        token_count,
        word_count,
        char_count,
        start_offset,
        end_offset,
        is_outdated,
        is_superseded,
        superseded_by_chunk_id,
        superseded_at,
        metadata,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.id,
        payload.documentId,
        payload.documentVersion,
        payload.projectId,
        payload.content,
        payload.chunkIndex,
        payload.tokenCount,
        payload.wordCount,
        payload.charCount,
        payload.startOffset,
        payload.endOffset,
        payload.isOutdated ? 1 : 0,
        payload.isSuperseded ? 1 : 0,
        payload.supersededByChunkId,
        payload.supersededAt,
        payload.metadata,
        payload.createdAt,
        payload.updatedAt,
      ],
    );
  }

  async saveMany(chunks: KnowledgeChunk[]): Promise<void> {
    for (const chunk of chunks) {
      await this.save(chunk);
    }
  }

  async findById(id: string): Promise<KnowledgeChunk | null> {
    await this.ensureInitialized();
    const { db } = getDatabase();
    const [result] = await db.executeSql('SELECT * FROM knowledge_chunks WHERE id = ?', [id]);
    if (result.rows.length === 0) return null;
    return this.mapRowToChunk(result.rows.item(0));
  }

  async findByDocumentId(documentId: string): Promise<KnowledgeChunk[]> {
    await this.ensureInitialized();
    const { db } = getDatabase();
    const [result] = await db.executeSql('SELECT * FROM knowledge_chunks WHERE document_id = ? ORDER BY chunk_index ASC', [documentId]);
    const chunks: KnowledgeChunk[] = [];
    for (let i = 0; i < result.rows.length; i++) {
      chunks.push(this.mapRowToChunk(result.rows.item(i)));
    }
    return chunks;
  }

  async findByDocumentVersion(documentId: string, version: number): Promise<KnowledgeChunk[]> {
    await this.ensureInitialized();
    const { db } = getDatabase();
    const [result] = await db.executeSql(
      'SELECT * FROM knowledge_chunks WHERE document_id = ? AND document_version = ? ORDER BY chunk_index ASC',
      [documentId, version],
    );

    const chunks: KnowledgeChunk[] = [];
    for (let i = 0; i < result.rows.length; i++) {
      chunks.push(this.mapRowToChunk(result.rows.item(i)));
    }
    return chunks;
  }

  async markSuperseded(oldChunkIds: string[], newerChunkId: string, supersededAt: Date): Promise<void> {
    if (oldChunkIds.length === 0) {
      return;
    }

    await this.ensureInitialized();
    const { db } = getDatabase();
    const timestamp = supersededAt.getTime();

    for (const chunkId of oldChunkIds) {
      await db.executeSql(
        `UPDATE knowledge_chunks SET
          is_outdated = ?,
          is_superseded = ?,
          superseded_by_chunk_id = ?,
          superseded_at = ?,
          updated_at = ?
        WHERE id = ?`,
        [1, 1, newerChunkId, timestamp, timestamp, chunkId],
      );
    }
  }

  async delete(id: string): Promise<void> {
    await this.ensureInitialized();
    const { db } = getDatabase();
    await db.executeSql('DELETE FROM knowledge_chunks WHERE id = ?', [id]);
  }
}
