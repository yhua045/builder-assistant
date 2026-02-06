import { ProjectRepository } from '../../domain/repositories/ProjectRepository';

export class UnarchiveProjectUseCase {
  constructor(private readonly repo: ProjectRepository) {}

  async execute(id: string, opts?: { unarchivedBy?: string }): Promise<void> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new Error(`Project not found: ${id}`);

    const patch: any = { archived: false, updatedAt: new Date() };
    if (opts?.unarchivedBy) patch.meta = { ...(existing.meta || {}), unarchivedBy: opts.unarchivedBy };

    if (typeof (this.repo as any).save === 'function') {
      await (this.repo as any).save({ ...existing, ...patch });
      return;
    }
    throw new Error('Repository does not support save');
  }
}
