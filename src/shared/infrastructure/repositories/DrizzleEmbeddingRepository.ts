import { getDatabase, initDatabase } from '../database/connection.ts';
import { KnowledgeEmbedding } from '../../../shared/domain/entities/KnowledgeEmbedding.ts';

export interface EmbeddingRepository {
  save(embedding: KnowledgeEmbedding): Promise<void>;
  findById(id: string): Promise<KnowledgeEmbedding | null>;
  findByChunkId(chunkId: string): Promise<KnowledgeEmbedding[]>;
  delete(id: string): Promise<void>;
}

export class DrizzleEmbeddingRepository implements EmbeddingRepository {
  private initialized = false;

  private async ensureInitialized() {
    if (this.initialized) return;
    await initDatabase();
    this.initialized = true;
  }

  private mapRowToEmbedding(row: any): KnowledgeEmbedding {
    return {
      id: row.id,
      chunkId: row.chunk_id,
      vector: row.vector ? JSON.parse(row.vector) : [],
      dimension: row.dimension,
      provider: row.provider ?? undefined,
      modelVersion: row.model_version ?? undefined,
      createdAt: new Date(row.created_at),
      fingerprint: row.fingerprint ?? undefined,
    };
  }

  async save(embedding: KnowledgeEmbedding): Promise<void> {
    await this.ensureInitialized();
    const { db } = getDatabase();

    const existing = await this.findById(embedding.id);
    if (existing) {
      await db.executeSql(
        `UPDATE knowledge_embeddings SET
          chunk_id = ?,
          vector = ?,
          dimension = ?,
          provider = ?,
          model_version = ?,
          fingerprint = ?,
          created_at = ?
        WHERE id = ?`,
        [
          embedding.chunkId,
          JSON.stringify(embedding.vector),
          embedding.dimension,
          embedding.provider ?? null,
          embedding.modelVersion ?? null,
          embedding.fingerprint ?? null,
          embedding.createdAt.getTime(),
          embedding.id,
        ],
      );
      return;
    }

    await db.executeSql(
      `INSERT INTO knowledge_embeddings (
        id,
        chunk_id,
        vector,
        dimension,
        provider,
        model_version,
        fingerprint,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        embedding.id,
        embedding.chunkId,
        JSON.stringify(embedding.vector),
        embedding.dimension,
        embedding.provider ?? null,
        embedding.modelVersion ?? null,
        embedding.fingerprint ?? null,
        embedding.createdAt.getTime(),
      ],
    );
  }

  async findById(id: string): Promise<KnowledgeEmbedding | null> {
    await this.ensureInitialized();
    const { db } = getDatabase();
    const [result] = await db.executeSql('SELECT * FROM knowledge_embeddings WHERE id = ?', [id]);
    if (result.rows.length === 0) return null;
    return this.mapRowToEmbedding(result.rows.item(0));
  }

  async findByChunkId(chunkId: string): Promise<KnowledgeEmbedding[]> {
    await this.ensureInitialized();
    const { db } = getDatabase();
    const [result] = await db.executeSql('SELECT * FROM knowledge_embeddings WHERE chunk_id = ? ORDER BY created_at ASC', [chunkId]);
    const embeddings: KnowledgeEmbedding[] = [];
    for (let i = 0; i < result.rows.length; i++) {
      embeddings.push(this.mapRowToEmbedding(result.rows.item(i)));
    }
    return embeddings;
  }

  async delete(id: string): Promise<void> {
    await this.ensureInitialized();
    const { db } = getDatabase();
    await db.executeSql('DELETE FROM knowledge_embeddings WHERE id = ?', [id]);
  }
}
