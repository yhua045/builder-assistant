import { DeleteTaskUseCase } from '../../src/application/usecases/task/DeleteTaskUseCase';
import { TaskRepository } from '../../src/domain/repositories/TaskRepository';

function makeMockTaskRepo(overrides: Partial<TaskRepository> = {}): TaskRepository {
  return {
    save: jest.fn(),
    findById: jest.fn().mockResolvedValue(null),
    findAll: jest.fn().mockResolvedValue([]),
    findByProjectId: jest.fn().mockResolvedValue([]),
    findAdHoc: jest.fn().mockResolvedValue([]),
    findUpcoming: jest.fn().mockResolvedValue([]),
    update: jest.fn(),
    delete: jest.fn().mockResolvedValue(undefined),
    addDependency: jest.fn(),
    removeDependency: jest.fn(),
    findDependencies: jest.fn().mockResolvedValue([]),
    findDependents: jest.fn().mockResolvedValue([]),
    addDelayReason: jest.fn(),
    removeDelayReason: jest.fn(),
    findDelayReasons: jest.fn().mockResolvedValue([]),
    deleteDependenciesByTaskId: jest.fn().mockResolvedValue(undefined),
    deleteDelayReasonsByTaskId: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('DeleteTaskUseCase', () => {
  it('deletes dependency rows before deleting the task', async () => {
    const callOrder: string[] = [];
    const repo = makeMockTaskRepo({
      deleteDependenciesByTaskId: jest.fn().mockImplementation(async () => { callOrder.push('deps'); }),
      deleteDelayReasonsByTaskId: jest.fn().mockImplementation(async () => { callOrder.push('delays'); }),
      delete: jest.fn().mockImplementation(async () => { callOrder.push('delete'); }),
    });
    const uc = new DeleteTaskUseCase(repo);

    await uc.execute('task-1');

    expect(repo.deleteDependenciesByTaskId).toHaveBeenCalledWith('task-1');
    expect(repo.deleteDelayReasonsByTaskId).toHaveBeenCalledWith('task-1');
    expect(repo.delete).toHaveBeenCalledWith('task-1');
    // cascade must happen before delete
    expect(callOrder).toEqual(['deps', 'delays', 'delete']);
  });

  it('still calls delete even if cascade methods are called', async () => {
    const repo = makeMockTaskRepo();
    const uc = new DeleteTaskUseCase(repo);

    await uc.execute('task-xyz');

    expect(repo.deleteDependenciesByTaskId).toHaveBeenCalledWith('task-xyz');
    expect(repo.deleteDelayReasonsByTaskId).toHaveBeenCalledWith('task-xyz');
    expect(repo.delete).toHaveBeenCalledWith('task-xyz');
  });
});
