/**
 * Unit tests for CreateTaskUseCase — optional id parameter.
 * Phase 1 (RED): These tests assert that when an id is provided to execute(),
 * the repository receives a task with that exact id.
 */

import { CreateTaskUseCase } from '../../src/application/usecases/task/CreateTaskUseCase';
import type { TaskRepository } from '../../src/domain/repositories/TaskRepository';

jest.mock('../../src/infrastructure/di/registerServices', () => ({}));

function makeMockTaskRepo(): TaskRepository {
  return {
    save: jest.fn().mockResolvedValue(undefined),
    findById: jest.fn().mockResolvedValue(null),
    findAll: jest.fn().mockResolvedValue([]),
    findByProjectId: jest.fn().mockResolvedValue([]),
    findAdHoc: jest.fn().mockResolvedValue([]),
    findUpcoming: jest.fn().mockResolvedValue([]),
    update: jest.fn(),
    delete: jest.fn(),
    addDependency: jest.fn(),
    removeDependency: jest.fn(),
    findDependencies: jest.fn().mockResolvedValue([]),
    findDependents: jest.fn().mockResolvedValue([]),
    addDelayReason: jest.fn(),
    removeDelayReason: jest.fn(),
    findDelayReasons: jest.fn().mockResolvedValue([]),
    deleteDependenciesByTaskId: jest.fn().mockResolvedValue(undefined),
    deleteDelayReasonsByTaskId: jest.fn().mockResolvedValue(undefined),
    findProgressLogs: jest.fn().mockResolvedValue([]),
    addProgressLog: jest.fn(),
    updateProgressLog: jest.fn(),
    deleteProgressLog: jest.fn(),
    findAllDependencies: jest.fn().mockResolvedValue([]),
    resolveDelayReason: jest.fn().mockResolvedValue(undefined),
    summarizeDelayReasons: jest.fn().mockResolvedValue([]),
  };
}

describe('CreateTaskUseCase', () => {
  describe('optional id parameter', () => {
    it('when id is provided, taskRepository.save is called with that exact id', async () => {
      const repo = makeMockTaskRepo();
      const useCase = new CreateTaskUseCase(repo);

      const result = await useCase.execute({
        id: 'cp-stable-abc123',
        projectId: 'proj-1',
        title: 'Test Task',
        status: 'pending',
      });

      expect(result.id).toBe('cp-stable-abc123');
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'cp-stable-abc123' }),
      );
    });

    it('when id is omitted, taskRepository.save is called with a generated id', async () => {
      const repo = makeMockTaskRepo();
      const useCase = new CreateTaskUseCase(repo);

      const result = await useCase.execute({
        projectId: 'proj-1',
        title: 'Test Task',
        status: 'pending',
      });

      expect(typeof result.id).toBe('string');
      expect(result.id.length).toBeGreaterThan(0);
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: result.id }),
      );
    });

    it('when id is provided with order, both are persisted correctly', async () => {
      const repo = makeMockTaskRepo();
      const useCase = new CreateTaskUseCase(repo);

      const result = await useCase.execute({
        id: 'cp-with-order',
        projectId: 'proj-2',
        title: 'Ordered Task',
        status: 'pending',
        order: 5,
      });

      expect(result.id).toBe('cp-with-order');
      expect(result.order).toBe(5);
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'cp-with-order', order: 5 }),
      );
    });
  });
});
