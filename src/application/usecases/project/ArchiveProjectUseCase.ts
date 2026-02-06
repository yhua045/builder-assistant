import { ProjectRepository } from '../../domain/repositories/ProjectRepository';

export class ArchiveProjectUseCase {
  constructor(private readonly repo: ProjectRepository) {}

  async execute(id: string, opts?: { archivedBy?: string }): Promise<void> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new Error(`Project not found: ${id}`);

    const patch: any = { archived: true, updatedAt: new Date() };
    if (opts?.archivedBy) patch.meta = { ...(existing.meta || {}), archivedBy: opts.archivedBy };

    // Persist updated entity via save (upsert)
    if (typeof (this.repo as any).save === 'function') {
      await (this.repo as any).save({ ...existing, ...patch });
      return;
    }
    throw new Error('Repository does not support save');
  }
}
