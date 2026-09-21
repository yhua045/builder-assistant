import { getDatabase, initDatabase } from '../../../../../shared/infrastructure/database/connection.ts';
import type {
  SemanticSearchMatch,
  SemanticSearchQueryRepository,
} from '../../application/contracts/SemanticSearchContracts';

interface SemanticSearchRow {
  chunk_id: string;
  document_id: string;
  document_version: number;
  project_id?: string | null;
  content: string;
  metadata?: string | null;
  vector: string;
  dimension: number;
  start_offset?: number | null;
  end_offset?: number | null;
  chunk_index?: number | null;
  created_at?: number | null;
}

export class DrizzleSemanticSearchRepository implements SemanticSearchQueryRepository {
  private initialized = false;

  private async ensureInitialized() {
    if (this.initialized) return;
    await initDatabase();
    this.initialized = true;
  }

  private parseMetadata(raw: unknown): Record<string, unknown> {
    if (!raw) return {};
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
      } catch {
        return {};
      }
    }
    return typeof raw === 'object' ? raw as Record<string, unknown> : {};
  }

  private normalizeVector(raw: unknown): number[] {
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw);
      } catch {
        return [];
      }
    }

    if (Array.isArray(raw)) {
      return raw.map((value) => Number(value)).filter((value) => Number.isFinite(value));
    }

    return [];
  }

  private scoreSimilarity(a: number[], b: number[]): number {
    if (a.length === 0 || b.length === 0 || a.length !== b.length) {
      return 0;
    }

    let dot = 0;
    let aMagnitude = 0;
    let bMagnitude = 0;

    for (let index = 0; index < a.length; index += 1) {
      const av = a[index] ?? 0;
      const bv = b[index] ?? 0;
      dot += av * bv;
      aMagnitude += av * av;
      bMagnitude += bv * bv;
    }

    if (aMagnitude === 0 || bMagnitude === 0) {
      return 0;
    }

    return dot / (Math.sqrt(aMagnitude) * Math.sqrt(bMagnitude));
  }

  private matchesMetadataFilters(
    metadata: Record<string, unknown>,
    filters?: Record<string, string | number | boolean | null>,
  ): boolean {
    if (!filters || Object.keys(filters).length === 0) {
      return true;
    }

    return Object.entries(filters).every(([key, expected]) => {
      const actual = metadata[key];
      if (expected === null || expected === undefined) {
        return actual == null;
      }
      return actual === expected;
    });
  }

  async findNearestMatches(
    queryVector: number[],
    options: {
      documentId?: string;
      projectId?: string;
      metadataFilters?: Record<string, string | number | boolean | null>;
      limit?: number;
      threshold?: number;
    },
  ): Promise<SemanticSearchMatch[]> {
    await this.ensureInitialized();
    const { db } = getDatabase();
    const [result] = await db.executeSql(
      `SELECT
        kc.id AS chunk_id,
        kc.document_id,
        kc.document_version,
        kc.project_id,
        kc.content,
        kc.metadata,
        kc.start_offset,
        kc.end_offset,
        kc.chunk_index,
        ke.vector,
        ke.dimension,
        ke.created_at
      FROM knowledge_embeddings ke
      INNER JOIN knowledge_chunks kc ON kc.id = ke.chunk_id
      LEFT JOIN documents requested_document ON requested_document.id = ?
      WHERE (? IS NULL OR kc.document_id = ? OR kc.document_id = requested_document.rag_source_document_id)
        AND (? IS NULL OR kc.project_id = ?)
        AND kc.is_outdated = 0`,
      [
        options.documentId ?? null,
        options.documentId ?? null,
        options.documentId ?? null,
        options.projectId ?? null,
        options.projectId ?? null,
      ],
    );

    const rows: SemanticSearchRow[] = [];
    for (let index = 0; index < result.rows.length; index += 1) {
      rows.push(result.rows.item(index));
    }

    const candidates: SemanticSearchMatch[] = [];
    for (const row of rows) {
      const vector = this.normalizeVector(row.vector);
      if (vector.length === 0 || row.dimension !== queryVector.length) {
        continue;
      }

      const metadata = this.parseMetadata(row.metadata);
      if (!this.matchesMetadataFilters(metadata, options.metadataFilters)) {
        continue;
      }

      const score = this.scoreSimilarity(queryVector, vector);
      if (Number.isFinite(options.threshold) && score < Number(options.threshold)) {
        continue;
      }

      candidates.push({
        chunkId: row.chunk_id,
        documentId: options.documentId ?? row.document_id,
        documentVersion: Number(row.document_version ?? 1),
        content: row.content,
        score,
        metadata,
        source: {
          page: typeof metadata.page === 'number' ? metadata.page : undefined,
          sectionHint: typeof metadata.sectionHint === 'string' ? metadata.sectionHint : undefined,
          startOffset: typeof row.start_offset === 'number' ? row.start_offset : undefined,
          endOffset: typeof row.end_offset === 'number' ? row.end_offset : undefined,
        },
      });
    }

    candidates.sort((left, right) => right.score - left.score);

    const limit = Number.isInteger(options.limit) && options.limit! > 0 ? options.limit! : candidates.length;
    return candidates.slice(0, limit);
  }
}
