import { AddDelayReasonUseCase } from '../../src/application/usecases/task/AddDelayReasonUseCase';
import { Task } from '../../src/domain/entities/Task';
import { TaskRepository } from '../../src/domain/repositories/TaskRepository';
import { DelayReasonTypeRepository } from '../../src/domain/repositories/DelayReasonTypeRepository';
import { DelayReason, DelayReasonType } from '../../src/domain/entities/DelayReason';

function makeMockTaskRepo(overrides: Partial<TaskRepository> = {}): TaskRepository {
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
    addDelayReason: jest.fn().mockImplementation(async (entry) => ({
      ...entry,
      id: 'delay-1',
      createdAt: new Date().toISOString(),
    })),
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

function makeMockTypeRepo(overrides: Partial<DelayReasonTypeRepository> = {}): DelayReasonTypeRepository {
  const types: DelayReasonType[] = [
    { id: 'WEATHER', label: 'Bad weather', displayOrder: 1, isActive: true },
    { id: 'MATERIAL_DELAY', label: 'Material / supply delay', displayOrder: 2, isActive: true },
    { id: 'OTHER', label: 'Other', displayOrder: 10, isActive: true },
  ];
  return {
    findAll: jest.fn().mockResolvedValue(types),
    findById: jest.fn().mockImplementation(async (id: string) => types.find(t => t.id === id) ?? null),
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

describe('AddDelayReasonUseCase', () => {
  it('adds a delay reason with a valid reasonTypeId', async () => {
    const task = makeTask('task-1');
    const taskRepo = makeMockTaskRepo({
      findById: jest.fn().mockResolvedValue(task),
    });
    const typeRepo = makeMockTypeRepo();
    const uc = new AddDelayReasonUseCase(taskRepo, typeRepo);

    const result = await uc.execute({
      taskId: 'task-1',
      reasonTypeId: 'WEATHER',
      notes: 'Heavy rain all week',
    });

    expect(result).toBeDefined();
    expect(result.id).toBeTruthy();
    expect(taskRepo.addDelayReason).toHaveBeenCalled();
    // Should also set task to blocked
    expect(taskRepo.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'blocked' }));
  });

  it('rejects empty reasonTypeId', async () => {
    const task = makeTask('task-1');
    const taskRepo = makeMockTaskRepo({ findById: jest.fn().mockResolvedValue(task) });
    const typeRepo = makeMockTypeRepo();
    const uc = new AddDelayReasonUseCase(taskRepo, typeRepo);

    await expect(uc.execute({ taskId: 'task-1', reasonTypeId: '' }))
      .rejects.toThrow(/reason.*type/i);
  });

  it('rejects unknown reasonTypeId', async () => {
    const task = makeTask('task-1');
    const taskRepo = makeMockTaskRepo({ findById: jest.fn().mockResolvedValue(task) });
    const typeRepo = makeMockTypeRepo({
      findById: jest.fn().mockResolvedValue(null),
    });
    const uc = new AddDelayReasonUseCase(taskRepo, typeRepo);

    await expect(uc.execute({ taskId: 'task-1', reasonTypeId: 'NONEXISTENT' }))
      .rejects.toThrow(/reason.*type.*not found/i);
  });

  it('rejects when task does not exist', async () => {
    const taskRepo = makeMockTaskRepo({ findById: jest.fn().mockResolvedValue(null) });
    const typeRepo = makeMockTypeRepo();
    const uc = new AddDelayReasonUseCase(taskRepo, typeRepo);

    await expect(uc.execute({ taskId: 'missing', reasonTypeId: 'WEATHER' }))
      .rejects.toThrow(/task.*not found/i);
  });

  it('does not change status if already blocked', async () => {
    const task = makeTask('task-1', { status: 'blocked' });
    const taskRepo = makeMockTaskRepo({
      findById: jest.fn().mockResolvedValue(task),
    });
    const typeRepo = makeMockTypeRepo();
    const uc = new AddDelayReasonUseCase(taskRepo, typeRepo);

    await uc.execute({ taskId: 'task-1', reasonTypeId: 'WEATHER' });

    // Should NOT have called update to change status since it's already blocked
    expect(taskRepo.update).not.toHaveBeenCalled();
  });
});
