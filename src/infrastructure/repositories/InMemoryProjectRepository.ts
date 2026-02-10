import { Project } from '../../domain/entities/Project';
import { ProjectRepository } from '../../domain/repositories/ProjectRepository';

export class InMemoryProjectRepository implements ProjectRepository {
  private items: Project[] = [];

  async save(project: Project): Promise<void> {
    const idx = this.items.findIndex(p => p.id === project.id);
    if (idx >= 0) {
      this.items[idx] = project;
    } else {
      this.items.push(project);
    }
  }

  async findById(id: string): Promise<Project | null> {
    const p = this.items.find(i => i.id === id);
    return p ? { ...p } : null;
  }

  async findByExternalId(_: string): Promise<Project | null> {
    return null;
  }

  async list(filters: any = {}, options: any = {}): Promise<{ items: Project[]; meta: { total: number; nextCursor?: string } }> {
    let results = this.items.slice();
    if (filters.status) {
      results = results.filter(r => r.status === filters.status);
    }
    const total = results.length;
    if (options.offset) results = results.slice(options.offset);
    if (options.limit) results = results.slice(0, options.limit);
    return { items: results.map(r => ({ ...r })), meta: { total } };
  }

  async count(filters: any = {}): Promise<number> {
    const listed = await this.list(filters);
    return listed.meta.total;
  }

  async findByStatus(status: string): Promise<Project[]> {
    return this.items.filter(i => i.status === status).map(i => ({ ...i }));
  }

  async findByPropertyId(_: string): Promise<Project[]> { return []; }
  async findByOwnerId(_: string): Promise<Project[]> { return []; }
  async findByPhaseDateRange(_: string, __?: string): Promise<Project[]> { return []; }
  async findWithUpcomingPhases(_: string): Promise<Project[]> { return []; }

  async delete(id: string): Promise<void> {
    this.items = this.items.filter(i => i.id !== id);
  }

  async withTransaction<T>(work: (repo: ProjectRepository) => Promise<T>): Promise<T> {
    // For in-memory, just execute directly
    return await work(this);
  }

}
