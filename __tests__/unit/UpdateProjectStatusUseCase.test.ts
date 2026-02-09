/**
 * Unit Tests: UpdateProjectStatusUseCase
 * 
 * Tests for status transition use case with workflow validation.
 */

import { UpdateProjectStatusUseCase } from '../../src/application/usecases/project/UpdateProjectStatusUseCase';
import { ProjectRepository } from '../../src/domain/repositories/ProjectRepository';
import { ProjectValidationService } from '../../src/domain/services/ProjectValidationService';
import { Project, ProjectStatus } from '../../src/domain/entities/Project';

describe('UpdateProjectStatusUseCase', () => {
  let useCase: UpdateProjectStatusUseCase;
  let mockRepository: jest.Mocked<ProjectRepository>;
  let validationService: ProjectValidationService;

  const mockProject: Project = {
    id: 'project-1',
    name: 'Test Project',
    status: ProjectStatus.PLANNING,
    materials: [],
    phases: [],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  beforeEach(() => {
    mockRepository = {
      findById: jest.fn(),
      save: jest.fn(),
      findAll: jest.fn(),
      delete: jest.fn(),
    } as any;

    validationService = new ProjectValidationService();
    useCase = new UpdateProjectStatusUseCase(mockRepository, validationService);
  });

  describe('execute', () => {
    describe('successful transitions', () => {
      it('should allow valid transition from PLANNING to IN_PROGRESS', async () => {
        mockRepository.findById.mockResolvedValue(mockProject);
        mockRepository.save.mockResolvedValue(undefined);

        const result = await useCase.execute({
          projectId: 'project-1',
          newStatus: ProjectStatus.IN_PROGRESS,
          reason: 'Construction started',
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.previousStatus).toBe(ProjectStatus.PLANNING);
          expect(result.data.newStatus).toBe(ProjectStatus.IN_PROGRESS);
          expect(result.data.projectId).toBe('project-1');
        }

        expect(mockRepository.save).toHaveBeenCalledWith(
          expect.objectContaining({
            status: ProjectStatus.IN_PROGRESS,
            meta: expect.objectContaining({
              lastStatusChange: expect.objectContaining({
                from: ProjectStatus.PLANNING,
                to: ProjectStatus.IN_PROGRESS,
                reason: 'Construction started',
              }),
            }),
          })
        );
      });

      it('should allow transition from IN_PROGRESS to COMPLETED', async () => {
        const inProgressProject = { ...mockProject, status: ProjectStatus.IN_PROGRESS };
        mockRepository.findById.mockResolvedValue(inProgressProject);
        mockRepository.save.mockResolvedValue(undefined);

        const result = await useCase.execute({
          projectId: 'project-1',
          newStatus: ProjectStatus.COMPLETED,
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.newStatus).toBe(ProjectStatus.COMPLETED);
        }
      });

      it('should allow transition from IN_PROGRESS to ON_HOLD', async () => {
        const inProgressProject = { ...mockProject, status: ProjectStatus.IN_PROGRESS };
        mockRepository.findById.mockResolvedValue(inProgressProject);
        mockRepository.save.mockResolvedValue(undefined);

        const result = await useCase.execute({
          projectId: 'project-1',
          newStatus: ProjectStatus.ON_HOLD,
          reason: 'Weather delay',
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.newStatus).toBe(ProjectStatus.ON_HOLD);
        }
      });

      it('should update the updatedAt timestamp', async () => {
        mockRepository.findById.mockResolvedValue(mockProject);
        mockRepository.save.mockResolvedValue(undefined);

        const beforeExecute = new Date();
        await useCase.execute({
          projectId: 'project-1',
          newStatus: ProjectStatus.IN_PROGRESS,
        });

        const savedProject = mockRepository.save.mock.calls[0][0];
        expect(savedProject.updatedAt).toBeDefined();
        expect(savedProject.updatedAt!.getTime()).toBeGreaterThanOrEqual(beforeExecute.getTime());
      });

      it('should preserve existing metadata', async () => {
        const projectWithMeta = {
          ...mockProject,
          meta: { customField: 'customValue' },
        };
        mockRepository.findById.mockResolvedValue(projectWithMeta);
        mockRepository.save.mockResolvedValue(undefined);

        await useCase.execute({
          projectId: 'project-1',
          newStatus: ProjectStatus.IN_PROGRESS,
        });

        const savedProject = mockRepository.save.mock.calls[0][0];
        expect(savedProject.meta).toBeDefined();
        expect(savedProject.meta!.customField).toBe('customValue');
        expect(savedProject.meta!.lastStatusChange).toBeDefined();
      });
    });

    describe('invalid transitions', () => {
      it('should reject transition from PLANNING to COMPLETED', async () => {
        mockRepository.findById.mockResolvedValue(mockProject);

        const result = await useCase.execute({
          projectId: 'project-1',
          newStatus: ProjectStatus.COMPLETED,
        });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toContain('Must move to IN_PROGRESS before COMPLETED');
        }

        expect(mockRepository.save).not.toHaveBeenCalled();
      });

      it('should reject transitions from terminal state COMPLETED', async () => {
        const completedProject = { ...mockProject, status: ProjectStatus.COMPLETED };
        mockRepository.findById.mockResolvedValue(completedProject);

        const result = await useCase.execute({
          projectId: 'project-1',
          newStatus: ProjectStatus.IN_PROGRESS,
        });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toContain('terminal');
        }

        expect(mockRepository.save).not.toHaveBeenCalled();
      });

      it('should reject transitions from terminal state CANCELLED', async () => {
        const cancelledProject = { ...mockProject, status: ProjectStatus.CANCELLED };
        mockRepository.findById.mockResolvedValue(cancelledProject);

        const result = await useCase.execute({
          projectId: 'project-1',
          newStatus: ProjectStatus.IN_PROGRESS,
        });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toContain('terminal');
        }

        expect(mockRepository.save).not.toHaveBeenCalled();
      });

      it('should reject transition from ON_HOLD to COMPLETED', async () => {
        const onHoldProject = { ...mockProject, status: ProjectStatus.ON_HOLD };
        mockRepository.findById.mockResolvedValue(onHoldProject);

        const result = await useCase.execute({
          projectId: 'project-1',
          newStatus: ProjectStatus.COMPLETED,
        });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toContain('Must resume to IN_PROGRESS before COMPLETED');
        }

        expect(mockRepository.save).not.toHaveBeenCalled();
      });
    });

    describe('error handling', () => {
      it('should return error when project not found', async () => {
        mockRepository.findById.mockResolvedValue(null);

        const result = await useCase.execute({
          projectId: 'non-existent',
          newStatus: ProjectStatus.IN_PROGRESS,
        });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toContain('Project not found');
        }

        expect(mockRepository.save).not.toHaveBeenCalled();
      });

      it('should handle repository errors gracefully', async () => {
        mockRepository.findById.mockRejectedValue(new Error('Database connection failed'));

        const result = await useCase.execute({
          projectId: 'project-1',
          newStatus: ProjectStatus.IN_PROGRESS,
        });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toContain('Database connection failed');
        }
      });

      it('should handle save errors gracefully', async () => {
        mockRepository.findById.mockResolvedValue(mockProject);
        mockRepository.save.mockRejectedValue(new Error('Save failed'));

        const result = await useCase.execute({
          projectId: 'project-1',
          newStatus: ProjectStatus.IN_PROGRESS,
        });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toContain('Save failed');
        }
      });
    });
  });

  describe('getAllowedStatuses', () => {
    it('should return allowed statuses for PLANNING project', async () => {
      mockRepository.findById.mockResolvedValue(mockProject);

      const result = await useCase.getAllowedStatuses('project-1');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toContain(ProjectStatus.IN_PROGRESS);
        expect(result.data).toContain(ProjectStatus.CANCELLED);
        expect(result.data).toHaveLength(2);
      }
    });

    it('should return allowed statuses for IN_PROGRESS project', async () => {
      const inProgressProject = { ...mockProject, status: ProjectStatus.IN_PROGRESS };
      mockRepository.findById.mockResolvedValue(inProgressProject);

      const result = await useCase.getAllowedStatuses('project-1');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toContain(ProjectStatus.COMPLETED);
        expect(result.data).toContain(ProjectStatus.ON_HOLD);
        expect(result.data).toContain(ProjectStatus.CANCELLED);
        expect(result.data).toHaveLength(3);
      }
    });

    it('should return empty array for terminal states', async () => {
      const completedProject = { ...mockProject, status: ProjectStatus.COMPLETED };
      mockRepository.findById.mockResolvedValue(completedProject);

      const result = await useCase.getAllowedStatuses('project-1');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(0);
      }
    });

    it('should return error when project not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      const result = await useCase.getAllowedStatuses('non-existent');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Project not found');
      }
    });

    it('should handle repository errors gracefully', async () => {
      mockRepository.findById.mockRejectedValue(new Error('Database error'));

      const result = await useCase.getAllowedStatuses('project-1');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Database error');
      }
    });
  });
});
