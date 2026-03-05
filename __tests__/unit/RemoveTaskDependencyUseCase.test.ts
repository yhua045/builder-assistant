import { RemoveTaskDependencyUseCase } from '../../src/application/usecases/task/RemoveTaskDependencyUseCase';
import { TaskRepository } from '../../src/domain/repositories/TaskRepository';

function makeMockRepo(overrides: Partial<TaskRepository> = {}): TaskRepository {
  return {
    save: jest.fn(),
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
    findAllDependencies: jest.fn().mockResolvedValue([]),
    resolveDelayReason: jest.fn().mockResolvedValue(undefined),
    summarizeDelayReasons: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe('RemoveTaskDependencyUseCase', () => {
  it('removes a dependency', async () => {
    const repo = makeMockRepo();
    const uc = new RemoveTaskDependencyUseCase(repo);

    await uc.execute({ taskId: 'task-a', dependsOnTaskId: 'task-b' });

    expect(repo.removeDependency).toHaveBeenCalledWith('task-a', 'task-b');
  });
});
