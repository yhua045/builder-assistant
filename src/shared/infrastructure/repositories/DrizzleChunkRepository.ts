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
      content: row.content,
      chunkIndex: row.chunk_index,
      tokenCount: row.token_count ?? undefined,
      startOffset: row.start_offset ?? undefined,
      endOffset: row.end_offset ?? undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
  }

  async save(chunk: KnowledgeChunk): Promise<void> {
    await this.ensureInitialized();
    const { db } = getDatabase();

    const existing = await this.findById(chunk.id);
    if (existing) {
      await db.executeSql(
        `UPDATE knowledge_chunks SET
          document_id = ?,
          content = ?,
          chunk_index = ?,
          token_count = ?,
          start_offset = ?,
          end_offset = ?,
          metadata = ?
        WHERE id = ?`,
        [
          chunk.documentId,
          chunk.content,
          chunk.chunkIndex,
          chunk.tokenCount ?? null,
          chunk.startOffset ?? null,
          chunk.endOffset ?? null,
          chunk.metadata ? JSON.stringify(chunk.metadata) : null,
          chunk.id,
        ],
      );
      return;
    }

    await db.executeSql(
      `INSERT INTO knowledge_chunks (
        id,
        document_id,
        content,
        chunk_index,
        token_count,
        start_offset,
        end_offset,
        metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        chunk.id,
        chunk.documentId,
        chunk.content,
        chunk.chunkIndex,
        chunk.tokenCount ?? null,
        chunk.startOffset ?? null,
        chunk.endOffset ?? null,
        chunk.metadata ? JSON.stringify(chunk.metadata) : null,
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

    for (const chunkId of oldChunkIds) {
      await db.executeSql(
        `UPDATE knowledge_chunks SET
          is_outdated = ?,
          is_superseded = ?,
          superseded_by_chunk_id = ?,
          superseded_at = ?
        WHERE id = ?`,
        [true, true, newerChunkId, supersededAt.getTime(), chunkId],
      );
    }
  }

  async delete(id: string): Promise<void> {
    await this.ensureInitialized();
    const { db } = getDatabase();
    await db.executeSql('DELETE FROM knowledge_chunks WHERE id = ?', [id]);
  }
}
