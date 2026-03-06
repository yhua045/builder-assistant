import { AddTaskDependencyUseCase } from '../../src/application/usecases/task/AddTaskDependencyUseCase';
import { Task } from '../../src/domain/entities/Task';
import { TaskRepository } from '../../src/domain/repositories/TaskRepository';
import { DelayReason } from '../../src/domain/entities/DelayReason';

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
    findProgressLogs: jest.fn().mockResolvedValue([]),
    addProgressLog: jest.fn(),
    findAllDependencies: jest.fn().mockResolvedValue([]),
    resolveDelayReason: jest.fn().mockResolvedValue(undefined),
    summarizeDelayReasons: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
}

function makeTask(id: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    title: `Task ${id}`,
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('AddTaskDependencyUseCase', () => {
  it('adds a dependency when both tasks exist', async () => {
    const taskA = makeTask('task-a');
    const taskB = makeTask('task-b');
    const repo = makeMockRepo({
      findById: jest.fn().mockImplementation(async (id: string) => {
        if (id === 'task-a') return taskA;
        if (id === 'task-b') return taskB;
        return null;
      }),
      findDependencies: jest.fn().mockResolvedValue([]),
    });
    const uc = new AddTaskDependencyUseCase(repo);

    await uc.execute({ taskId: 'task-a', dependsOnTaskId: 'task-b' });

    expect(repo.addDependency).toHaveBeenCalledWith('task-a', 'task-b');
  });

  it('rejects self-dependency', async () => {
    const task = makeTask('task-a');
    const repo = makeMockRepo({
      findById: jest.fn().mockResolvedValue(task),
    });
    const uc = new AddTaskDependencyUseCase(repo);

    await expect(uc.execute({ taskId: 'task-a', dependsOnTaskId: 'task-a' }))
      .rejects.toThrow(/self-dependency/i);
  });

  it('rejects when task does not exist', async () => {
    const repo = makeMockRepo({
      findById: jest.fn().mockResolvedValue(null),
    });
    const uc = new AddTaskDependencyUseCase(repo);

    await expect(uc.execute({ taskId: 'task-a', dependsOnTaskId: 'task-b' }))
      .rejects.toThrow(/not found/i);
  });

  it('rejects circular dependency', async () => {
    const taskA = makeTask('task-a');
    const taskB = makeTask('task-b');
    const repo = makeMockRepo({
      findById: jest.fn().mockImplementation(async (id: string) => {
        if (id === 'task-a') return taskA;
        if (id === 'task-b') return taskB;
        return null;
      }),
      // task-b already depends on task-a → adding task-a depends on task-b would be circular
      findDependencies: jest.fn().mockImplementation(async (id: string) => {
        if (id === 'task-b') return [taskA];
        return [];
      }),
    });
    const uc = new AddTaskDependencyUseCase(repo);

    await expect(uc.execute({ taskId: 'task-a', dependsOnTaskId: 'task-b' }))
      .rejects.toThrow(/circular/i);
  });
});
