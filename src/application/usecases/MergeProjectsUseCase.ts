import { ProjectRepository } from '../../domain/repositories/ProjectRepository';
import { ProjectEntity } from '../../domain/entities/Project';

export class MergeProjectsUseCase {
  constructor(private readonly repo: ProjectRepository) {}

  async execute(targetId: string, sourceId: string, opts?: { fieldsToKeep?: string[]; mergedBy?: string }): Promise<ProjectEntity> {
    // TDD: implementation to be added after tests are written and failing.
    throw new Error('Not implemented');
  }
}
