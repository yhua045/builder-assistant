import { Quotation } from '../../../../domain/entities/Quotation';
import { Task } from '../../../../domain/entities/Task';
import { QuotationRepository } from '../../../../domain/repositories/QuotationRepository';
import { TaskRepository } from '../../../../domain/repositories/TaskRepository';
import {
  DeclineQuotationUseCase,
} from '../../application/DeclineQuotationUseCase';

// ── Mock factories ────────────────────────────────────────────────────────────

function makeQuotation(overrides: Partial<Quotation> = {}): Quotation {
  return {
    id: 'quot-1',
    reference: 'QUO-2026-001',
    date: '2026-04-09',
    total: 5000,
    currency: 'AUD',
    status: 'pending_approval',
    projectId: 'proj-1',
    vendorName: 'Acme Builders',
    createdAt: '2026-04-09T00:00:00.000Z',
    updatedAt: '2026-04-09T00:00:00.000Z',
    ...overrides,
  };
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Review Quotation: Acme Builders',
    status: 'pending',
    taskType: 'contract_work',
    quoteStatus: 'issued',
    projectId: 'proj-1',
    ...overrides,
  };
}

function makeQuotationRepo(overrides: Partial<QuotationRepository> = {}): QuotationRepository {
  return {
    createQuotation: jest.fn(),
    getQuotation: jest.fn().mockResolvedValue(makeQuotation()),
    updateQuotation: jest.fn(async (_id: string, updates: Partial<Quotation>) => ({
      ...makeQuotation(),
      ...updates,
    })),
    deleteQuotation: jest.fn(),
    findByReference: jest.fn(),
    findByTask: jest.fn().mockResolvedValue([]),
    findByProjectId: jest.fn().mockResolvedValue([]),
    listQuotations: jest.fn(),
    ...overrides,
  } as unknown as QuotationRepository;
}

function makeTaskRepo(overrides: Partial<TaskRepository> = {}): TaskRepository {
  return {
    save: jest.fn(),
    findById: jest.fn().mockResolvedValue(makeTask()),
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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('DeclineQuotationUseCase', () => {
  it('throws QUOTATION_NOT_FOUND when quotation does not exist', async () => {
    const quotationRepo = makeQuotationRepo({
      getQuotation: jest.fn().mockResolvedValue(null),
    });
    const uc = new DeclineQuotationUseCase(quotationRepo, makeTaskRepo());

    await expect(uc.execute({ quotationId: 'missing' })).rejects.toThrow('QUOTATION_NOT_FOUND');
  });

  it('throws QUOTATION_NOT_PENDING_APPROVAL when status is sent', async () => {
    const quotationRepo = makeQuotationRepo({
      getQuotation: jest.fn().mockResolvedValue(makeQuotation({ status: 'sent' })),
    });
    const uc = new DeclineQuotationUseCase(quotationRepo, makeTaskRepo());

    await expect(uc.execute({ quotationId: 'quot-1' })).rejects.toThrow(
      'QUOTATION_NOT_PENDING_APPROVAL',
    );
  });

  it('declines a quotation when status is draft', async () => {
    const quotationRepo = makeQuotationRepo({
      getQuotation: jest.fn().mockResolvedValue(makeQuotation({ status: 'draft' })),
    });
    const uc = new DeclineQuotationUseCase(quotationRepo, makeTaskRepo());

    await expect(uc.execute({ quotationId: 'quot-1' })).resolves.toBeUndefined();
  });

  it('throws QUOTATION_NOT_PENDING_APPROVAL when status is declined', async () => {
    const quotationRepo = makeQuotationRepo({
      getQuotation: jest.fn().mockResolvedValue(makeQuotation({ status: 'declined' })),
    });
    const uc = new DeclineQuotationUseCase(quotationRepo, makeTaskRepo());

    await expect(uc.execute({ quotationId: 'quot-1' })).rejects.toThrow(
      'QUOTATION_NOT_PENDING_APPROVAL',
    );
  });

  it('transitions quotation status to declined', async () => {
    const updates: Array<{ id: string; patch: Partial<Quotation> }> = [];
    const quotationRepo = makeQuotationRepo({
      updateQuotation: jest.fn(async (id: string, patch: Partial<Quotation>) => {
        updates.push({ id, patch });
        return { ...makeQuotation(), ...patch };
      }),
    });
    const uc = new DeclineQuotationUseCase(quotationRepo, makeTaskRepo());

    await uc.execute({ quotationId: 'quot-1' });

    expect(updates).toHaveLength(1);
    expect(updates[0].id).toBe('quot-1');
    expect(updates[0].patch.status).toBe('declined');
  });

  it('updates linked task quoteStatus to declined when taskId is set', async () => {
    const quotationWithTask = makeQuotation({ taskId: 'task-1' });
    const quotationRepo = makeQuotationRepo({
      getQuotation: jest.fn().mockResolvedValue(quotationWithTask),
    });
    const taskUpdates: Task[] = [];
    const taskRepo = makeTaskRepo({
      update: jest.fn(async (t: Task) => { taskUpdates.push(t); }),
    });
    const uc = new DeclineQuotationUseCase(quotationRepo, taskRepo);

    await uc.execute({ quotationId: 'quot-1' });

    expect(taskUpdates).toHaveLength(1);
    expect(taskUpdates[0].quoteStatus).toBe('rejected');
  });

  it('does not update task when taskId is not set', async () => {
    const quotationNoTask = makeQuotation({ taskId: undefined });
    const quotationRepo = makeQuotationRepo({
      getQuotation: jest.fn().mockResolvedValue(quotationNoTask),
    });
    const taskRepo = makeTaskRepo();
    const uc = new DeclineQuotationUseCase(quotationRepo, taskRepo);

    await uc.execute({ quotationId: 'quot-1' });

    expect(taskRepo.update as jest.Mock).not.toHaveBeenCalled();
  });
});
