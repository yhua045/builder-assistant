import { getDatabase, initDatabase } from '../database/connection.ts';
import { ProjectFact } from '../../../shared/domain/entities/ProjectFact.ts';

export interface KnowledgeRepository {
  saveFact(fact: ProjectFact): Promise<void>;
  findFactById(id: string): Promise<ProjectFact | null>;
  findFactsByProjectId(projectId: string): Promise<ProjectFact[]>;
  deleteFact(id: string): Promise<void>;
}

export class DrizzleKnowledgeRepository implements KnowledgeRepository {
  private initialized = false;

  private async ensureInitialized() {
    if (this.initialized) return;
    await initDatabase();
    this.initialized = true;
  }

  private mapRowToFact(row: any): ProjectFact {
    return {
      id: row.id,
      projectId: row.project_id,
      factType: row.fact_type,
      canonicalText: row.canonical_text,
      normalizedText: row.normalized_text ?? undefined,
      status: row.status,
      confidence: row.confidence ?? undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  async saveFact(fact: ProjectFact): Promise<void> {
    await this.ensureInitialized();
    const { db } = getDatabase();

    const existing = await this.findFactById(fact.id);
    if (existing) {
      await db.executeSql(
        `UPDATE project_facts SET
          project_id = ?,
          fact_type = ?,
          canonical_text = ?,
          normalized_text = ?,
          status = ?,
          confidence = ?,
          updated_at = ?
        WHERE id = ?`,
        [
          fact.projectId,
          fact.factType,
          fact.canonicalText,
          fact.normalizedText ?? null,
          fact.status,
          fact.confidence ?? null,
          fact.updatedAt.getTime(),
          fact.id,
        ],
      );
      return;
    }

    await db.executeSql(
      `INSERT INTO project_facts (
        id,
        project_id,
        fact_type,
        canonical_text,
        normalized_text,
        status,
        confidence,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        fact.id,
        fact.projectId,
        fact.factType,
        fact.canonicalText,
        fact.normalizedText ?? null,
        fact.status,
        fact.confidence ?? null,
        fact.createdAt.getTime(),
        fact.updatedAt.getTime(),
      ],
    );
  }

  async findFactById(id: string): Promise<ProjectFact | null> {
    await this.ensureInitialized();
    const { db } = getDatabase();
    const [result] = await db.executeSql('SELECT * FROM project_facts WHERE id = ?', [id]);
    if (result.rows.length === 0) return null;
    return this.mapRowToFact(result.rows.item(0));
  }

  async findFactsByProjectId(projectId: string): Promise<ProjectFact[]> {
    await this.ensureInitialized();
    const { db } = getDatabase();
    const [result] = await db.executeSql('SELECT * FROM project_facts WHERE project_id = ? ORDER BY created_at ASC', [projectId]);
    const facts: ProjectFact[] = [];
    for (let i = 0; i < result.rows.length; i++) {
      facts.push(this.mapRowToFact(result.rows.item(i)));
    }
    return facts;
  }

  async deleteFact(id: string): Promise<void> {
    await this.ensureInitialized();
    const { db } = getDatabase();
    await db.executeSql('DELETE FROM project_facts WHERE id = ?', [id]);
  }
}
