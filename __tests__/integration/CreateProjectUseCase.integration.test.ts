import { CreateProjectUseCase } from '../../src/application/usecases/project/CreateProjectUseCase';
import { InMemoryProjectRepository } from '../../src/infrastructure/repositories/InMemoryProjectRepository';

describe('CreateProjectUseCase integration (InMemoryRepo)', () => {
  it('persists project to repository and can be retrieved', async () => {
    const repo = new InMemoryProjectRepository();
    const uc = new CreateProjectUseCase(repo as any);

    const start = new Date();
    const end = new Date(Date.now() + 1000 * 60 * 60 * 24 * 45);

    const res = await uc.execute({
      name: 'Integration Project',
      description: 'desc',
      budget: 15000,
      startDate: start,
      expectedEndDate: end
    });

    expect(res.success).toBe(true);
    expect(res.projectId).toBeDefined();

    const persisted = await repo.findById(res.projectId!);
    expect(persisted).not.toBeNull();
    expect(persisted && persisted.name).toBe('Integration Project');
  });

  it('supports withTransaction semantics', async () => {
    const repo = new InMemoryProjectRepository();
    const uc = new CreateProjectUseCase(repo as any);

    await repo.withTransaction(async (txRepo) => {
      await txRepo.save({
        id: 'tx_proj',
        name: 'tx',
        status: 'planning',
        materials: [],
        phases: []
      } as any);
    });

    const found = await repo.findById('tx_proj');
    expect(found).not.toBeNull();
  });
});
