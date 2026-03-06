import { GetDelayStatisticsUseCase } from '../../src/application/usecases/task/GetDelayStatisticsUseCase';
import { TaskRepository } from '../../src/domain/repositories/TaskRepository';
import { DelayReasonTypeRepository } from '../../src/domain/repositories/DelayReasonTypeRepository';
import { DelayReasonType } from '../../src/domain/entities/DelayReason';

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
    addDelayReason: jest.fn(),
    removeDelayReason: jest.fn(),
    resolveDelayReason: jest.fn().mockResolvedValue(undefined),
    findDelayReasons: jest.fn().mockResolvedValue([]),
    summarizeDelayReasons: jest.fn().mockResolvedValue([]),
    deleteDependenciesByTaskId: jest.fn().mockResolvedValue(undefined),
    deleteDelayReasonsByTaskId: jest.fn().mockResolvedValue(undefined),
    findProgressLogs: jest.fn().mockResolvedValue([]),
    addProgressLog: jest.fn(),
    findAllDependencies: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
}

function makeMockTypeRepo(
  types: DelayReasonType[] = [
    { id: 'WEATHER', label: 'Bad weather', displayOrder: 1, isActive: true },
    { id: 'MATERIAL_DELAY', label: 'Material / supply delay', displayOrder: 2, isActive: true },
    { id: 'OTHER', label: 'Other', displayOrder: 10, isActive: true },
  ],
): DelayReasonTypeRepository {
  return {
    findAll: jest.fn().mockResolvedValue(types),
    findById: jest.fn().mockImplementation(async (id: string) => types.find((t) => t.id === id) ?? null),
  };
}

describe('GetDelayStatisticsUseCase', () => {
  it('returns empty array when no delay reasons exist', async () => {
    const taskRepo = makeMockTaskRepo({ summarizeDelayReasons: jest.fn().mockResolvedValue([]) });
    const typeRepo = makeMockTypeRepo();
    const uc = new GetDelayStatisticsUseCase(taskRepo, typeRepo);

    const result = await uc.execute();
    expect(result).toEqual([]);
  });

  it('merges summary counts with human-readable labels', async () => {
    const taskRepo = makeMockTaskRepo({
      summarizeDelayReasons: jest.fn().mockResolvedValue([
        { reasonTypeId: 'WEATHER', count: 5 },
        { reasonTypeId: 'MATERIAL_DELAY', count: 2 },
      ]),
    });
    const typeRepo = makeMockTypeRepo();
    const uc = new GetDelayStatisticsUseCase(taskRepo, typeRepo);

    const result = await uc.execute();

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ reasonTypeId: 'WEATHER', label: 'Bad weather', count: 5 });
    expect(result[1]).toEqual({ reasonTypeId: 'MATERIAL_DELAY', label: 'Material / supply delay', count: 2 });
  });

  it('uses reasonTypeId as fallback label if not found in type catalog', async () => {
    const taskRepo = makeMockTaskRepo({
      summarizeDelayReasons: jest.fn().mockResolvedValue([
        { reasonTypeId: 'UNKNOWN_CUSTOM', count: 1 },
      ]),
    });
    const typeRepo = makeMockTypeRepo(); // does not contain UNKNOWN_CUSTOM
    const uc = new GetDelayStatisticsUseCase(taskRepo, typeRepo);

    const result = await uc.execute();
    expect(result[0].label).toBe('UNKNOWN_CUSTOM');
  });

  it('passes taskId filter through to the repository', async () => {
    const summarizeDelayReasons = jest.fn().mockResolvedValue([]);
    const taskRepo = makeMockTaskRepo({ summarizeDelayReasons });
    const typeRepo = makeMockTypeRepo();
    const uc = new GetDelayStatisticsUseCase(taskRepo, typeRepo);

    await uc.execute({ taskId: 'task-42' });

    expect(summarizeDelayReasons).toHaveBeenCalledWith('task-42');
  });

  it('calls summarizeDelayReasons with undefined when no taskId provided', async () => {
    const summarizeDelayReasons = jest.fn().mockResolvedValue([]);
    const taskRepo = makeMockTaskRepo({ summarizeDelayReasons });
    const typeRepo = makeMockTypeRepo();
    const uc = new GetDelayStatisticsUseCase(taskRepo, typeRepo);

    await uc.execute({});

    expect(summarizeDelayReasons).toHaveBeenCalledWith(undefined);
  });
});
