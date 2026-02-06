import { CreateProjectUseCase } from '../../src/application/usecases/project/CreateProjectUseCase';
import { ProjectRepository } from '../../src/domain/repositories/ProjectRepository';

describe('CreateProjectUseCase validation (TDD)', () => {
  const makeRepo = (existing: any[] = []) => ({
    findAll: jest.fn().mockResolvedValue(existing),
    save: jest.fn().mockResolvedValue(undefined)
  }) as Partial<ProjectRepository> as ProjectRepository;

  it('rejects when name is missing', async () => {
    const repo = makeRepo();
    const uc = new CreateProjectUseCase(repo);

    const request = {
      name: '',
      description: 'desc',
      budget: 20000,
      startDate: new Date(),
      expectedEndDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 40)
    };

    const res = await uc.execute(request as any);
    expect(res.success).toBe(false);
    expect(res.errors && res.errors[0]).toMatch(/Project name is required/);
  });

  it('rejects negative budget', async () => {
    const repo = makeRepo();
    const uc = new CreateProjectUseCase(repo);

    const request = {
      name: 'X',
      description: 'desc',
      budget: -5,
      startDate: new Date(),
      expectedEndDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 40)
    };

    const res = await uc.execute(request as any);
    expect(res.success).toBe(false);
    expect(res.errors && res.errors[0]).toMatch(/Project budget cannot be negative/);
  });

  it('rejects when startDate is after expectedEndDate', async () => {
    const repo = makeRepo();
    const uc = new CreateProjectUseCase(repo);

    const request = {
      name: 'X',
      description: 'desc',
      budget: 100000,
      startDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 10),
      expectedEndDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5)
    };

    const res = await uc.execute(request as any);
    expect(res.success).toBe(false);
    expect(res.errors && res.errors[0]).toMatch(/Expected end date must be after start date/);
  });

  it('returns error when a project with same name exists', async () => {
    const existing = [{ id: 'p1', name: 'SameName' }];
    const repo = makeRepo(existing);
    const uc = new CreateProjectUseCase(repo);

    const request = {
      name: 'SameName',
      description: 'desc',
      budget: 20000,
      startDate: new Date(),
      expectedEndDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 60)
    };

    const res = await uc.execute(request as any);
    expect(res.success).toBe(false);
    expect(res.errors && res.errors[0]).toMatch(/A project with this name already exists/);
  });
});
