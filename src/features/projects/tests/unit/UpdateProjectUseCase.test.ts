/**
 * Unit Tests: UpdateProjectUseCase
 *
 * Track D — Step 8 (Issue #176)
 * Asserts: validation, field persistence, immutability of protected fields, not-found guard.
 */

import { UpdateProjectUseCase, UpdateProjectRequest } from '../../application/UpdateProjectUseCase';
import { ProjectRepository } from '../../../../domain/repositories/ProjectRepository';
import { Project, ProjectStatus } from '../../../../domain/entities/Project';

// ─── helpers ─────────────────────────────────────────────────────────────────

const baseProject: Project = {
  id: 'proj-001',
  name: 'Original Name',
  description: 'Original desc',
  location: '1 Main St',
  status: ProjectStatus.IN_PROGRESS,
  budget: 50000,
  currency: 'AUD',
  startDate: new Date('2025-01-01'),
  expectedEndDate: new Date('2025-12-31'),
  ownerId: 'owner-99',
  propertyId: 'prop-99',
  phases: [{ id: 'ph-1', name: 'Foundations', projectId: 'proj-001' }],
  materials: [{ id: 'mat-1', name: 'Timber', quantity: 10, unit: 'piece', unitCost: 5, projectId: 'proj-001' }],
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

function makeMockRepo(project: Project | null = baseProject): jest.Mocked<ProjectRepository> {
  return {
    findById: jest.fn().mockResolvedValue(project),
    save: jest.fn().mockResolvedValue(undefined),
    findAll: jest.fn(),
    list: jest.fn(),
    count: jest.fn(),
    delete: jest.fn(),
    findByStatus: jest.fn(),
    findByPropertyId: jest.fn(),
    findByOwnerId: jest.fn(),
    findByPhaseDateRange: jest.fn(),
    findWithUpcomingPhases: jest.fn(),
    findByExternalId: jest.fn(),
    findDetailsById: jest.fn(),
    listDetails: jest.fn(),
    withTransaction: jest.fn(),
  } as unknown as jest.Mocked<ProjectRepository>;
}

// ─── suite ───────────────────────────────────────────────────────────────────

describe('UpdateProjectUseCase', () => {
  let useCase: UpdateProjectUseCase;
  let mockRepo: jest.Mocked<ProjectRepository>;

  beforeEach(() => {
    mockRepo = makeMockRepo();
    useCase = new UpdateProjectUseCase(mockRepo);
  });

  // ── validation ─────────────────────────────────────────────────────────────

  it('returns failure when name is empty', async () => {
    const request: UpdateProjectRequest = {
      projectId: 'proj-001',
      name: '   ',
    };
    const result = await useCase.execute(request);
    expect(result.success).toBe(false);
    expect(result.errors).toContain('Project name is required');
    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it('returns failure when end date is not after start date', async () => {
    const request: UpdateProjectRequest = {
      projectId: 'proj-001',
      name: 'Valid Name',
      startDate: new Date('2025-06-01'),
      expectedEndDate: new Date('2025-06-01'), // same day — invalid
    };
    const result = await useCase.execute(request);
    expect(result.success).toBe(false);
    expect(result.errors).toContain('End date must be after start date');
    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  // ── not found ──────────────────────────────────────────────────────────────

  it('returns failure when project does not exist', async () => {
    mockRepo = makeMockRepo(null);
    useCase = new UpdateProjectUseCase(mockRepo);
    const request: UpdateProjectRequest = {
      projectId: 'ghost-proj',
      name: 'Any Name',
    };
    const result = await useCase.execute(request);
    expect(result.success).toBe(false);
    expect(result.errors).toContain('Project not found: ghost-proj');
  });

  // ── persistence ────────────────────────────────────────────────────────────

  it('persists all editable fields on success', async () => {
    const request: UpdateProjectRequest = {
      projectId: 'proj-001',
      name: 'Updated Name',
      description: 'New description',
      location: '99 New Rd',
      startDate: new Date('2025-02-01'),
      expectedEndDate: new Date('2025-11-01'),
      budget: 75000,
      currency: 'USD',
      fireZone: 'BAL-29',
    };

    const result = await useCase.execute(request);

    expect(result.success).toBe(true);
    expect(mockRepo.save).toHaveBeenCalledTimes(1);

    const saved = mockRepo.save.mock.calls[0][0] as Project;
    expect(saved.name).toBe('Updated Name');
    expect(saved.description).toBe('New description');
    expect(saved.location).toBe('99 New Rd');
    expect(saved.budget).toBe(75000);
    expect(saved.currency).toBe('USD');
    expect(saved.fireZone).toBe('BAL-29');
    expect(saved.startDate).toEqual(new Date('2025-02-01'));
    expect(saved.expectedEndDate).toEqual(new Date('2025-11-01'));
  });

  it('preserves phases, materials, status, and ownerId unchanged', async () => {
    const request: UpdateProjectRequest = {
      projectId: 'proj-001',
      name: 'Changed Name',
    };

    await useCase.execute(request);

    const saved = mockRepo.save.mock.calls[0][0] as Project;
    expect(saved.status).toBe(ProjectStatus.IN_PROGRESS); // unchanged
    expect(saved.ownerId).toBe('owner-99');                // unchanged
    expect(saved.phases).toHaveLength(1);                  // unchanged
    expect(saved.phases[0].name).toBe('Foundations');
    expect(saved.materials).toHaveLength(1);               // unchanged
    expect(saved.materials[0].name).toBe('Timber');
  });

  it('updates updatedAt timestamp on save', async () => {
    const before = new Date();
    const request: UpdateProjectRequest = {
      projectId: 'proj-001',
      name: 'Timestamp Test',
    };

    await useCase.execute(request);

    const saved = mockRepo.save.mock.calls[0][0] as Project;
    expect(saved.updatedAt).toBeInstanceOf(Date);
    expect(saved.updatedAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });
});
