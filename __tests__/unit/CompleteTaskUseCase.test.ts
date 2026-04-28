import { CompleteTaskUseCase } from '../../src/features/tasks/application/CompleteTaskUseCase';
import { TaskRepository } from '../../src/domain/repositories/TaskRepository';
import { QuotationRepository } from '../../src/domain/repositories/QuotationRepository';
import { TaskNotFoundError, TaskCompletionValidationError } from '../../src/features/tasks/application/TaskCompletionErrors';
import { Task } from '../../src/domain/entities/Task';
import { Quotation } from '../../src/domain/entities/Quotation';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Test Task',
    status: 'pending',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeQuotation(overrides: Partial<Quotation> = {}): Quotation {
  return {
    id: 'q-1',
    reference: 'QT-2026-001',
    date: '2026-01-15',
    total: 1000,
    currency: 'USD',
    status: 'accepted',
    createdAt: '2026-01-15T00:00:00.000Z',
    updatedAt: '2026-01-15T00:00:00.000Z',
    ...overrides,
  };
}

function makeMockTaskRepo(overrides: Partial<TaskRepository> = {}): TaskRepository {
  return {
    save: jest.fn(),
    findById: jest.fn().mockResolvedValue(null),
    findAll: jest.fn().mockResolvedValue([]),
    findByProjectId: jest.fn().mockResolvedValue([]),
    findAdHoc: jest.fn().mockResolvedValue([]),
    findUpcoming: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    addDependency: jest.fn(),
    removeDependency: jest.fn(),
    findDependencies: jest.fn().mockResolvedValue([]),
    findDependents: jest.fn().mockResolvedValue([]),
    findAllDependencies: jest.fn().mockResolvedValue([]),
    addDelayReason: jest.fn(),
    removeDelayReason: jest.fn(),
    findDelayReasons: jest.fn().mockResolvedValue([]),
    resolveDelayReason: jest.fn().mockResolvedValue(undefined),
    summarizeDelayReasons: jest.fn().mockResolvedValue([]),
    deleteDependenciesByTaskId: jest.fn().mockResolvedValue(undefined),
    deleteDelayReasonsByTaskId: jest.fn().mockResolvedValue(undefined),
    findProgressLogs: jest.fn().mockResolvedValue([]),
    addProgressLog: jest.fn(),
    updateProgressLog: jest.fn(),
    deleteProgressLog: jest.fn(),
    ...overrides,
  } as unknown as TaskRepository;
}

function makeMockQuotationRepo(
  findByTaskResult: Quotation[] = [],
): QuotationRepository {
  return {
    createQuotation: jest.fn(),
    getQuotation: jest.fn(),
    updateQuotation: jest.fn(),
    deleteQuotation: jest.fn(),
    findByReference: jest.fn(),
    findByTask: jest.fn().mockResolvedValue(findByTaskResult),
    findByProjectId: jest.fn(),
    listQuotations: jest.fn(),
  } as unknown as QuotationRepository;
}

describe('CompleteTaskUseCase', () => {
  // T-10: Task not found → throws TaskNotFoundError
  it('throws TaskNotFoundError when the task does not exist', async () => {
    const taskRepo = makeMockTaskRepo({ findById: jest.fn().mockResolvedValue(null) });
    const quotationRepo = makeMockQuotationRepo([]);
    const useCase = new CompleteTaskUseCase(taskRepo, quotationRepo);

    await expect(useCase.execute('nonexistent-task')).rejects.toThrow(TaskNotFoundError);
    expect(taskRepo.update).not.toHaveBeenCalled();
  });

  // T-11: Task already completed → no-op (no update call)
  it('is a no-op when the task is already completed', async () => {
    const task = makeTask({ status: 'completed' });
    const taskRepo = makeMockTaskRepo({ findById: jest.fn().mockResolvedValue(task) });
    const quotationRepo = makeMockQuotationRepo([]);
    const useCase = new CompleteTaskUseCase(taskRepo, quotationRepo);

    await useCase.execute('task-1');

    expect(taskRepo.update).not.toHaveBeenCalled();
  });

  // T-12: Validation fails → throws TaskCompletionValidationError; update not called
  it('throws TaskCompletionValidationError when there are pending quotations', async () => {
    const task = makeTask({ status: 'in_progress' });
    const pendingQuotation = makeQuotation({ status: 'draft' });
    const taskRepo = makeMockTaskRepo({ findById: jest.fn().mockResolvedValue(task) });
    const quotationRepo = makeMockQuotationRepo([pendingQuotation]);
    const useCase = new CompleteTaskUseCase(taskRepo, quotationRepo);

    await expect(useCase.execute('task-1')).rejects.toThrow(TaskCompletionValidationError);
    expect(taskRepo.update).not.toHaveBeenCalled();
  });

  // T-13: TaskCompletionValidationError carries blocking quotation refs
  it('includes blocking quotations in the error', async () => {
    const task = makeTask({ status: 'pending' });
    const q1 = makeQuotation({ id: 'q-1', reference: 'QT-001', status: 'draft' });
    const q2 = makeQuotation({ id: 'q-2', reference: 'QT-002', status: 'sent' });
    const taskRepo = makeMockTaskRepo({ findById: jest.fn().mockResolvedValue(task) });
    const quotationRepo = makeMockQuotationRepo([q1, q2]);
    const useCase = new CompleteTaskUseCase(taskRepo, quotationRepo);

    let caughtError: TaskCompletionValidationError | undefined;
    try {
      await useCase.execute('task-1');
    } catch (err) {
      if (err instanceof TaskCompletionValidationError) {
        caughtError = err;
      }
    }

    expect(caughtError).toBeDefined();
    expect(caughtError!.pendingQuotations).toHaveLength(2);
    expect(caughtError!.pendingQuotations.map(q => q.id)).toContain('q-1');
    expect(caughtError!.pendingQuotations.map(q => q.id)).toContain('q-2');
  });

  // T-14: Successful completion → update called with status: 'completed'
  it('calls taskRepository.update with status completed on success', async () => {
    const task = makeTask({ status: 'in_progress' });
    const taskRepo = makeMockTaskRepo({ findById: jest.fn().mockResolvedValue(task) });
    const quotationRepo = makeMockQuotationRepo([makeQuotation({ status: 'accepted' })]);
    const useCase = new CompleteTaskUseCase(taskRepo, quotationRepo);

    await useCase.execute('task-1');

    expect(taskRepo.update).toHaveBeenCalledTimes(1);
    const updatedTask = (taskRepo.update as jest.Mock).mock.calls[0][0] as Task;
    expect(updatedTask.status).toBe('completed');
  });

  // T-15: Successful completion → completedAt is set to ISO string
  it('sets completedAt to an ISO timestamp on success', async () => {
    const task = makeTask({ status: 'pending' });
    const taskRepo = makeMockTaskRepo({ findById: jest.fn().mockResolvedValue(task) });
    const quotationRepo = makeMockQuotationRepo([]);
    const useCase = new CompleteTaskUseCase(taskRepo, quotationRepo);

    const before = new Date().toISOString();
    await useCase.execute('task-1');
    const after = new Date().toISOString();

    const updatedTask = (taskRepo.update as jest.Mock).mock.calls[0][0] as Task;
    expect(updatedTask.completedAt).toBeDefined();
    expect(updatedTask.completedAt! >= before).toBe(true);
    expect(updatedTask.completedAt! <= after).toBe(true);
  });

  // Error class structural checks
  it('TaskNotFoundError has correct name and message', () => {
    const err = new TaskNotFoundError('task-xyz');
    expect(err.name).toBe('TaskNotFoundError');
    expect(err.message).toContain('task-xyz');
  });

  it('TaskCompletionValidationError has correct name, code, and message', () => {
    const pending = [{ id: 'q-1', reference: 'QT-001', status: 'draft' as const }];
    const err = new TaskCompletionValidationError(pending);
    expect(err.name).toBe('TaskCompletionValidationError');
    expect(err.code).toBe('PENDING_QUOTATIONS');
    expect(err.message).toContain('QT-001');
    expect(err.pendingQuotations).toHaveLength(1);
  });
});
