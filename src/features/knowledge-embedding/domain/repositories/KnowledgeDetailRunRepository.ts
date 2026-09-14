import type { KnowledgeDetailRun } from '../entities/KnowledgeDetailRun';

export interface KnowledgeDetailRunRepository {
  create(run: KnowledgeDetailRun): Promise<KnowledgeDetailRun>;
  findByRunId(runId: string): Promise<KnowledgeDetailRun[]>;
  findById(id: string): Promise<KnowledgeDetailRun | null>;
  update(id: string, patch: Partial<KnowledgeDetailRun>): Promise<KnowledgeDetailRun>;
}
