import { GetTaskDetailUseCase, TaskDetail } from '../../src/application/usecases/task/GetTaskDetailUseCase';
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

describe('GetTaskDetailUseCase', () => {
  it('returns null if task not found', async () => {
    const repo = makeMockRepo();
    const uc = new GetTaskDetailUseCase(repo);

    const result = await uc.execute('missing');
    expect(result).toBeNull();
  });

  it('returns hydrated task detail with dependencies and delay reasons', async () => {
    const task = makeTask('task-1', { subcontractorId: 'contact-1' });
    const depTask = makeTask('dep-1', { status: 'completed' });
    const delay: DelayReason = {
      id: 'delay-1',
      taskId: 'task-1',
      reasonTypeId: 'WEATHER',
      reasonTypeLabel: 'Bad weather',
      notes: 'Rained all day',
      createdAt: new Date().toISOString(),
    };

    const repo = makeMockRepo({
      findById: jest.fn().mockResolvedValue(task),
      findDependencies: jest.fn().mockResolvedValue([depTask]),
      findDelayReasons: jest.fn().mockResolvedValue([delay]),
    });
    const uc = new GetTaskDetailUseCase(repo);

    const result = await uc.execute('task-1');

    expect(result).not.toBeNull();
    expect(result!.id).toBe('task-1');
    expect(result!.dependencyTasks).toHaveLength(1);
    expect(result!.dependencyTasks[0].id).toBe('dep-1');
    expect(result!.delayReasons).toHaveLength(1);
    expect(result!.delayReasons[0].reasonTypeId).toBe('WEATHER');
    expect(result!.subcontractorId).toBe('contact-1');
  });

  it('returns empty arrays when task has no dependencies or delays', async () => {
    const task = makeTask('task-2');
    const repo = makeMockRepo({
      findById: jest.fn().mockResolvedValue(task),
      findDependencies: jest.fn().mockResolvedValue([]),
      findDelayReasons: jest.fn().mockResolvedValue([]),
    });
    const uc = new GetTaskDetailUseCase(repo);

    const result = await uc.execute('task-2');

    expect(result).not.toBeNull();
    expect(result!.dependencyTasks).toEqual([]);
    expect(result!.delayReasons).toEqual([]);
  });
});
