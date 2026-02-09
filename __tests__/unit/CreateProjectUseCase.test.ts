import { CreateProjectUseCase } from '../../src/application/usecases/project/CreateProjectUseCase';
import { ProjectRepository } from '../../src/domain/repositories/ProjectRepository';

describe('CreateProjectUseCase (TDD)', () => {
  it('rejects when project name is missing', async () => {
    const mockRepo: Partial<ProjectRepository> = {
      list: jest.fn().mockResolvedValue({ items: [], meta: { total: 0 } }),
      save: jest.fn().mockResolvedValue(undefined)
    };

    const usecase = new CreateProjectUseCase(mockRepo as ProjectRepository);

    const result = await usecase.execute({
      name: '',
      description: 'desc',
      budget: 1000,
      startDate: new Date(),
      expectedEndDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 10)
    });

    expect(result.success).toBe(false);
    expect(result.errors && result.errors[0]).toMatch(/Project name is required/);
  });

  it('rejects when duplicate project name exists (case-insensitive)', async () => {
    const existing = { id: 'p1', name: 'My Project' } as any;
    const mockRepo: Partial<ProjectRepository> = {
      list: jest.fn().mockResolvedValue({ items: [existing], meta: { total: 1 } }),
      save: jest.fn().mockResolvedValue(undefined)
    };

    const usecase = new CreateProjectUseCase(mockRepo as ProjectRepository);

    const result = await usecase.execute({
      name: 'my project',
      description: 'desc',
      budget: 20000,
      startDate: new Date(Date.now() - 1000 * 60 * 60 * 24),
      expectedEndDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 60)
    });

    expect(result.success).toBe(false);
    expect(result.errors).toContain('A project with this name already exists');
  });

  it('returns warnings for short timeline and low budget', async () => {
    const mockRepo: Partial<ProjectRepository> = {
      list: jest.fn().mockResolvedValue({ items: [], meta: { total: 0 } }),
      save: jest.fn().mockResolvedValue(undefined)
    };

    const usecase = new CreateProjectUseCase(mockRepo as ProjectRepository);

    const start = new Date();
    const end = new Date(Date.now() + 1000 * 60 * 60 * 24 * 10); // 10 days

    const result = await usecase.execute({
      name: 'New Project',
      description: 'desc',
      budget: 5000,
      startDate: start,
      expectedEndDate: end
    });

    expect(result.success).toBe(true);
    expect(result.warnings).toBeDefined();
    expect(result.warnings && result.warnings.some(w => /timeline/i.test(w))).toBe(true);
    expect(result.warnings && result.warnings.some(w => /budget/i.test(w))).toBe(true);
  });

  it('saves project and returns projectId on success', async () => {
    const mockRepo: Partial<ProjectRepository> = {
      list: jest.fn().mockResolvedValue({ items: [], meta: { total: 0 } }),
      save: jest.fn().mockResolvedValue(undefined)
    };

    const usecase = new CreateProjectUseCase(mockRepo as ProjectRepository);

    const start = new Date();
    const end = new Date(Date.now() + 1000 * 60 * 60 * 24 * 90); // 90 days

    const result = await usecase.execute({
      name: 'Brand New',
      description: 'desc',
      budget: 20000,
      startDate: start,
      expectedEndDate: end
    });

    expect(result.success).toBe(true);
    expect(result.projectId).toBeDefined();
    expect((mockRepo.save as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(1);
  });
});
