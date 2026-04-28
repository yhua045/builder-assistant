import { GetTaskDetailUseCase } from '../../src/features/tasks/application/GetTaskDetailUseCase';
import { Task } from '../../src/domain/entities/Task';
import { TaskRepository } from '../../src/domain/repositories/TaskRepository';
import { DelayReason } from '../../src/domain/entities/DelayReason';
import { QuotationRepository } from '../../src/domain/repositories/QuotationRepository';
import { Quotation } from '../../src/domain/entities/Quotation';

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
    updateProgressLog: jest.fn(),
    deleteProgressLog: jest.fn(),
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

  it('returns empty linkedQuotations when no QuotationRepository injected', async () => {
    const task = makeTask('task-3');
    const repo = makeMockRepo({
      findById: jest.fn().mockResolvedValue(task),
    });
    const uc = new GetTaskDetailUseCase(repo);

    const result = await uc.execute('task-3');

    expect(result).not.toBeNull();
    expect(result!.linkedQuotations).toEqual([]);
  });

  it('returns linkedQuotations from QuotationRepository.findByTask when injected', async () => {
    const task = makeTask('task-4');
    const quotation: Quotation = {
      id: 'quot-1',
      reference: 'QUO-001',
      date: '2026-04-09',
      total: 5000,
      currency: 'AUD',
      status: 'pending_approval',
      taskId: 'task-4',
      createdAt: '2026-04-09T00:00:00.000Z',
      updatedAt: '2026-04-09T00:00:00.000Z',
    };
    const repo = makeMockRepo({
      findById: jest.fn().mockResolvedValue(task),
    });
    const quotationRepo: QuotationRepository = {
      createQuotation: jest.fn(),
      getQuotation: jest.fn(),
      updateQuotation: jest.fn(),
      deleteQuotation: jest.fn(),
      findByReference: jest.fn(),
      findByTask: jest.fn().mockResolvedValue([quotation]),
      findByProjectId: jest.fn().mockResolvedValue([]),
      listQuotations: jest.fn(),
    } as unknown as QuotationRepository;

    const uc = new GetTaskDetailUseCase(repo, quotationRepo);
    const result = await uc.execute('task-4');

    expect(result).not.toBeNull();
    expect(result!.linkedQuotations).toHaveLength(1);
    expect(result!.linkedQuotations[0].id).toBe('quot-1');
    expect((quotationRepo.findByTask as jest.Mock).mock.calls[0][0]).toBe('task-4');
  });
});
