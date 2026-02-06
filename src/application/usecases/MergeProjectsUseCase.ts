import { ProjectRepository } from '../../domain/repositories/ProjectRepository';
import { ProjectEntity } from '../../domain/entities/Project';

export class MergeProjectsUseCase {
  constructor(private readonly repo: ProjectRepository) {}

  async execute(targetId: string, sourceId: string, opts?: { fieldsToKeep?: string[]; mergedBy?: string }): Promise<ProjectEntity> {
    const target = await this.repo.findById(targetId);
    const source = await this.repo.findById(sourceId);
    if (!target) throw new Error(`Target project not found: ${targetId}`);
    if (!source) throw new Error(`Source project not found: ${sourceId}`);

    // Basic merge: keep target id, prefer target fields unless missing, merge arrays
    const merged: any = {
      ...source,
      ...target,
      id: targetId,
      materials: [ ...(target.materials || []), ...(source.materials || []) ],
      phases: [ ...(target.phases || []), ...(source.phases || []) ],
      updatedAt: new Date(),
    };

    if (opts?.mergedBy) merged.meta = { ...(merged.meta || {}), mergedBy: opts.mergedBy };

    // Persist merged project using save (upsert).
    if (typeof (this.repo as any).save === 'function') {
      await (this.repo as any).save(merged);
    } else {
      throw new Error('Repository does not support save');
    }

    // Optionally remove source
    if (typeof (this.repo as any).delete === 'function') {
      await (this.repo as any).delete(sourceId);
    }

    return ProjectEntity.fromData(merged);
  }
}
