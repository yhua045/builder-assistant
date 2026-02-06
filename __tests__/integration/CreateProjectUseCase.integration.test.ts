import { CreateProjectUseCase } from '../../src/application/usecases/project/CreateProjectUseCase';
import { ProjectRepository } from '../../src/domain/repositories/ProjectRepository';

// Simple in-memory repository for integration-style tests
class InMemoryProjectRepository implements ProjectRepository {
  private store = new Map<string, any>();
  async init(): Promise<void> { return; }
  async findAll(): Promise<any[]> { return Array.from(this.store.values()); }
  async findById(id: string): Promise<any | null> { return this.store.get(id) ?? null; }
  async save(project: any): Promise<void> { this.store.set(project.id, project); }
  async delete(id: string): Promise<void> { this.store.delete(id); }
  async exists(id: string): Promise<boolean> { return this.store.has(id); }
  async findByExternalId(): Promise<any | null> { return null; }
  async list(): Promise<{ items: any[]; total: number }> { const items = Array.from(this.store.values()); return { items, total: items.length }; }
  async count(): Promise<number> { return this.store.size; }
}

describe('CreateProjectUseCase integration with repository', () => {
  it('persists a valid project using repository', async () => {
    const repo = new InMemoryProjectRepository();
    const uc = new CreateProjectUseCase(repo as unknown as ProjectRepository);

    const request = {
      name: 'Integration Project',
      description: 'desc',
      budget: 50000,
      startDate: new Date(),
      expectedEndDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 45)
    };

    const res = await uc.execute(request as any);
    expect(res.success).toBe(true);
    expect(res.projectId).toBeDefined();

    const all = await repo.findAll();
    expect(all.length).toBe(1);
    expect(all[0].name).toBe('Integration Project');
  });

  it('does not persist invalid project and returns errors', async () => {
    const repo = new InMemoryProjectRepository();
    const uc = new CreateProjectUseCase(repo as unknown as ProjectRepository);

    const request = {
      name: '',
      description: 'desc',
      budget: 1000,
      startDate: new Date(),
      expectedEndDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2)
    };

    const res = await uc.execute(request as any);
    expect(res.success).toBe(false);
    expect(res.errors && res.errors.length).toBeGreaterThan(0);

    const all = await repo.findAll();
    expect(all.length).toBe(0);
  });
});
