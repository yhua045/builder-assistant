import { ProjectRepository } from '../../domain/repositories/ProjectRepository';
import { Project } from '../../domain/entities/Project';

export class BulkUpdateProjectsUseCase {
  constructor(private readonly repo: ProjectRepository) {}

  async execute(ids: string[], patch: Partial<Project>, opts?: { transactional?: boolean; updatedBy?: string }): Promise<{ succeeded: string[]; failed: { id: string; reason: string }[] }> {
    // TDD: implementation to be added after tests are written and failing.
    throw new Error('Not implemented');
  }
}
