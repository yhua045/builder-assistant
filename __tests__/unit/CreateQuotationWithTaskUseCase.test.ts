import { Quotation } from '../../src/domain/entities/Quotation';
import { Task } from '../../src/domain/entities/Task';
import { QuotationRepository } from '../../src/domain/repositories/QuotationRepository';
import { TaskRepository } from '../../src/domain/repositories/TaskRepository';
import {
  CreateQuotationWithTaskUseCase,
  CreateQuotationWithTaskInput,
} from '../../src/application/usecases/quotation/CreateQuotationWithTaskUseCase';

// ── Mock factories ────────────────────────────────────────────────────────────

function makeMockQuotationRepo(
  overrides: Partial<QuotationRepository> = {},
): QuotationRepository {
  return {
    createQuotation: jest.fn(async (q: Quotation) => q),
    getQuotation: jest.fn(),
    updateQuotation: jest.fn(),
    deleteQuotation: jest.fn(),
    findByReference: jest.fn(),
    findByTask: jest.fn().mockResolvedValue([]),
    findByProjectId: jest.fn().mockResolvedValue([]),
    listQuotations: jest.fn(),
    ...overrides,
  } as unknown as QuotationRepository;
}

function makeMockTaskRepo(overrides: Partial<TaskRepository> = {}): TaskRepository {
  return {
    save: jest.fn().mockResolvedValue(undefined),
    findById: jest.fn().mockResolvedValue(null),
    findAll: jest.fn().mockResolvedValue([]),
    findByProjectId: jest.fn().mockResolvedValue([]),
    findAdHoc: jest.fn().mockResolvedValue([]),
    findUpcoming: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn(),
    addDependency: jest.fn(),
    removeDependency: jest.fn(),
    findDependencies: jest.fn().mockResolvedValue([]),
    findDependents: jest.fn().mockResolvedValue([]),
    findAllDependencies: jest.fn().mockResolvedValue([]),
    addDelayReason: jest.fn(),
    removeDelayReason: jest.fn(),
    resolveDelayReason: jest.fn(),
    findDelayReasons: jest.fn().mockResolvedValue([]),
    summarizeDelayReasons: jest.fn().mockResolvedValue([]),
    deleteDependenciesByTaskId: jest.fn(),
    deleteDelayReasonsByTaskId: jest.fn(),
    findProgressLogs: jest.fn().mockResolvedValue([]),
    addProgressLog: jest.fn(),
    updateProgressLog: jest.fn(),
    deleteProgressLog: jest.fn(),
    ...overrides,
  } as unknown as TaskRepository;
}

function makeInput(
  overrides: Partial<CreateQuotationWithTaskInput['quotation']> = {},
): CreateQuotationWithTaskInput {
  return {
    quotation: {
      reference: 'QUO-TEST-001',
      projectId: 'proj-1',
      vendorName: 'Acme Builders',
      date: '2026-04-09',
      total: 5000,
      currency: 'AUD',
      ...overrides,
    } as any,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CreateQuotationWithTaskUseCase', () => {
  it('throws QUOTATION_PROJECT_REQUIRED when projectId is absent', async () => {
    const quotationRepo = makeMockQuotationRepo();
    const taskRepo = makeMockTaskRepo();
    const uc = new CreateQuotationWithTaskUseCase(quotationRepo, taskRepo);

    await expect(
      uc.execute(makeInput({ projectId: undefined })),
    ).rejects.toThrow('QUOTATION_PROJECT_REQUIRED');
  });

  it('throws QUOTATION_PROJECT_REQUIRED when projectId is empty string', async () => {
    const quotationRepo = makeMockQuotationRepo();
    const taskRepo = makeMockTaskRepo();
    const uc = new CreateQuotationWithTaskUseCase(quotationRepo, taskRepo);

    await expect(
      uc.execute(makeInput({ projectId: '' })),
    ).rejects.toThrow('QUOTATION_PROJECT_REQUIRED');
  });

  it('creates a task with correct auto-derived fields', async () => {
    const savedTasks: Task[] = [];
    const taskRepo = makeMockTaskRepo({
      save: jest.fn(async (t: Task) => { savedTasks.push(t); }),
    });
    const quotationRepo = makeMockQuotationRepo();
    const uc = new CreateQuotationWithTaskUseCase(quotationRepo, taskRepo);

    await uc.execute(makeInput());

    expect(savedTasks).toHaveLength(1);
    const task = savedTasks[0];
    expect(task.title).toBe('Review Quotation: Acme Builders');
    expect(task.status).toBe('pending');
    expect(task.taskType).toBe('contract_work');
    expect(task.quoteStatus).toBe('issued');
    expect(task.quoteAmount).toBe(5000);
    expect(task.projectId).toBe('proj-1');
  });

  it('uses reference as task title fallback when vendorName is absent', async () => {
    const savedTasks: Task[] = [];
    const taskRepo = makeMockTaskRepo({
      save: jest.fn(async (t: Task) => { savedTasks.push(t); }),
    });
    const quotationRepo = makeMockQuotationRepo();
    const uc = new CreateQuotationWithTaskUseCase(quotationRepo, taskRepo);

    await uc.execute(makeInput({ vendorName: undefined }));

    expect(savedTasks[0].title).toBe('Review Quotation: QUO-TEST-001');
  });

  it('creates quotation with status pending_approval and taskId set', async () => {
    const createdQuotations: Quotation[] = [];
    const taskRepo = makeMockTaskRepo({
      save: jest.fn(async (_t: Task) => {
        // simulate save returning nothing; task.id is pre-assigned
      }),
    });
    const quotationRepo = makeMockQuotationRepo({
      createQuotation: jest.fn(async (q: Quotation) => {
        createdQuotations.push(q);
        return q;
      }),
    });
    const uc = new CreateQuotationWithTaskUseCase(quotationRepo, taskRepo);

    await uc.execute(makeInput());

    expect(createdQuotations).toHaveLength(1);
    expect(createdQuotations[0].status).toBe('pending_approval');
    expect(typeof createdQuotations[0].taskId).toBe('string');
    expect(createdQuotations[0].taskId).toBeTruthy();
  });

  it('returns { quotation, task } with quotation.taskId === task.id', async () => {
    const taskRepo = makeMockTaskRepo();
    const quotationRepo = makeMockQuotationRepo();
    const uc = new CreateQuotationWithTaskUseCase(quotationRepo, taskRepo);

    const result = await uc.execute(makeInput());

    expect(result.quotation).toBeDefined();
    expect(result.task).toBeDefined();
    expect(result.quotation.taskId).toBe(result.task.id);
  });
});
