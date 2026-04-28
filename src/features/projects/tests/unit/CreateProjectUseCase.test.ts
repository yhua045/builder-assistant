import { CreateProjectUseCase } from '../../application/CreateProjectUseCase';
import { ProjectRepository } from '../../../../domain/repositories/ProjectRepository';

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

  it('rejects when end date is before start date', async () => {
    const mockRepo: Partial<ProjectRepository> = {
      list: jest.fn().mockResolvedValue({ items: [], meta: { total: 0 } }),
      save: jest.fn().mockResolvedValue(undefined)
    };

    const usecase = new CreateProjectUseCase(mockRepo as ProjectRepository);

    const start = new Date('2026-12-31');
    const end = new Date('2026-01-01'); // before start

    const result = await usecase.execute({
      name: 'Test Project',
      startDate: start,
      expectedEndDate: end
    });

    expect(result.success).toBe(false);
    expect(result.errors).toContain('End date must be after start date');
  });

  it('rejects duplicate project for same owner and address', async () => {
    const existing = {
      id: 'p1',
      name: 'Existing',
      location: '123 Main St',
      ownerId: 'owner1'
    } as any;

    const mockRepo: Partial<ProjectRepository> = {
      list: jest.fn().mockResolvedValue({ items: [existing], meta: { total: 1 } }),
      save: jest.fn().mockResolvedValue(undefined)
    };

    const usecase = new CreateProjectUseCase(mockRepo as ProjectRepository);

    const result = await usecase.execute({
      name: 'New Project',
      address: '123 Main St',
      projectOwner: 'owner1'
    });

    expect(result.success).toBe(false);
    expect(result.errors).toContain('A project for this owner and address already exists');
  });

  it('allows duplicate address with different owner', async () => {
    const existing = {
      id: 'p1',
      name: 'Existing',
      location: '123 Main St',
      ownerId: 'owner1'
    } as any;

    const mockRepo: Partial<ProjectRepository> = {
      list: jest.fn().mockResolvedValue({ items: [existing], meta: { total: 1 } }),
      save: jest.fn().mockResolvedValue(undefined)
    };

    const usecase = new CreateProjectUseCase(mockRepo as ProjectRepository);

    const result = await usecase.execute({
      name: 'New Project',
      address: '123 Main St',
      projectOwner: 'owner2' // different owner
    });

    expect(result.success).toBe(true);
  });

  it('allows same owner with no address specified', async () => {
    const existing = {
      id: 'p1',
      name: 'Existing',
      location: '123 Main St',
      ownerId: 'owner1'
    } as any;

    const mockRepo: Partial<ProjectRepository> = {
      list: jest.fn().mockResolvedValue({ items: [existing], meta: { total: 1 } }),
      save: jest.fn().mockResolvedValue(undefined)
    };

    const usecase = new CreateProjectUseCase(mockRepo as ProjectRepository);

    const result = await usecase.execute({
      name: 'New Project',
      projectOwner: 'owner1'
      // no address
    });

    expect(result.success).toBe(true);
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

  it('saves project with all fields and returns projectId on success', async () => {
    const mockRepo: Partial<ProjectRepository> = {
      list: jest.fn().mockResolvedValue({ items: [], meta: { total: 0 } }),
      save: jest.fn().mockResolvedValue(undefined)
    };

    const usecase = new CreateProjectUseCase(mockRepo as ProjectRepository);

    const start = new Date();
    const end = new Date(Date.now() + 1000 * 60 * 60 * 24 * 90); // 90 days

    const result = await usecase.execute({
      name: 'Brand New',
      description: 'A new building project',
      address: '456 Oak St',
      projectOwner: 'owner2',
      team: 'Team A',
      visibility: 'Public',
      budget: 20000,
      priority: 'High',
      notes: 'Important notes',
      startDate: start,
      expectedEndDate: end
    });

    expect(result.success).toBe(true);
    expect(result.projectId).toBeDefined();
    expect((mockRepo.save as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(1);
    
    // Verify saved project has correct metadata
    const savedProject = (mockRepo.save as jest.Mock).mock.calls[0][0];
    expect(savedProject.name).toBe('Brand New');
    expect(savedProject.location).toBe('456 Oak St');
    expect(savedProject.ownerId).toBe('owner2');
    expect(savedProject.meta?.team).toBe('Team A');
    expect(savedProject.meta?.priority).toBe('High');
  });

  // ── Track C — Issue #176: address → location mapping ──────────────────────

  it('stores request.address as project.location, not propertyId', async () => {
    const mockRepo: Partial<ProjectRepository> = {
      list: jest.fn().mockResolvedValue({ items: [], meta: { total: 0 } }),
      save: jest.fn().mockResolvedValue(undefined),
    };

    const usecase = new CreateProjectUseCase(mockRepo as ProjectRepository);

    await usecase.execute({
      name: 'Test Project',
      address: '5 Main St, Melbourne VIC 3000',
    });

    const savedProject = (mockRepo.save as jest.Mock).mock.calls[0][0];
    expect(savedProject.location).toBe('5 Main St, Melbourne VIC 3000');
    expect(savedProject.propertyId).toBeUndefined();
  });
});
