import { ProjectRepository } from '../../domain/repositories/ProjectRepository';

export class UnarchiveProjectUseCase {
  constructor(private readonly repo: ProjectRepository) {}

  async execute(id: string, opts?: { unarchivedBy?: string }): Promise<void> {
    // TDD: implementation to be added after tests are written and failing.
    throw new Error('Not implemented');
  }
}
