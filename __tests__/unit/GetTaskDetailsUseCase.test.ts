/**
 * Unit tests for GetTaskDetailsUseCase
 * Design: design/issue-210-task-screens-refactor.md §4
 *
 * Acceptance criteria:
 * - Returns null when task is not found
 * - Returns populated DTO with task, taskDetail, nextInLine, documents
 * - Fetches all parallel data in a single Promise.all round
 * - Maps subcontractorId to SubcontractorInfo via ContactRepository
 * - Sets subcontractorInfo to null when task has no subcontractorId
 * - Sets subcontractorInfo to null when contact is not found
 * - Fetches linkedInvoice when quoteInvoiceId is set
 * - Sets linkedInvoice to null when quoteInvoiceId is not set
 * - Handles linkedInvoice fetch failure gracefully
 * - Sets hasQuotationRecord=true when a matching quotation exists
 * - Sets hasQuotationRecord=false when no matching quotation
 * - Does not check quotations when quoteInvoiceId is already set
 * - Slices nextInLine to max 3 dependents
 */

import { GetTaskDetailsUseCase } from '../../src/application/usecases/task/GetTaskDetailsUseCase';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TASK_ID = 'task-1';

const TASK: any = {
  id: TASK_ID,
  title: 'Install flooring',
  status: 'pending',
  projectId: 'proj-1',
  subcontractorId: 'contact-1',
  quoteInvoiceId: null,
  quoteAmount: null,
};

const CONTACT: any = {
  id: 'contact-1',
  name: 'Bob Builder',
  trade: 'Flooring',
  phone: '0400000001',
  email: 'bob@builder.com',
};

const DOCUMENT: any = { id: 'doc-1', taskId: TASK_ID, filename: 'invoice.pdf' };

// ── Mock repos ────────────────────────────────────────────────────────────────

let mockTaskRepo: any;
let mockDocumentRepo: any;
let mockInvoiceRepo: any;
let mockQuotationRepo: any;
let mockContactRepo: any;

let useCase: GetTaskDetailsUseCase;

beforeEach(() => {
  mockTaskRepo = {
    findById: jest.fn().mockResolvedValue(TASK),
    findDependencies: jest.fn().mockResolvedValue([]),
    findDelayReasons: jest.fn().mockResolvedValue([]),
    findProgressLogs: jest.fn().mockResolvedValue([]),
    findDependents: jest.fn().mockResolvedValue([]),
  };
  mockDocumentRepo = {
    findByTaskId: jest.fn().mockResolvedValue([DOCUMENT]),
  };
  mockInvoiceRepo = {
    getInvoice: jest.fn().mockResolvedValue(null),
  };
  mockQuotationRepo = {
    findByTask: jest.fn().mockResolvedValue([]),
    listQuotations: jest.fn().mockResolvedValue({ items: [], total: 0 }),
  };
  mockContactRepo = {
    findById: jest.fn().mockResolvedValue(CONTACT),
  };
  useCase = new GetTaskDetailsUseCase(
    mockTaskRepo,
    mockDocumentRepo,
    mockInvoiceRepo,
    mockQuotationRepo,
    mockContactRepo,
  );
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GetTaskDetailsUseCase', () => {
  // ── Null guard ───────────────────────────────────────────────────────────────

  describe('task not found', () => {
    it('returns null when task is not found', async () => {
      mockTaskRepo.findById.mockResolvedValue(null);
      const result = await useCase.execute(TASK_ID);
      expect(result).toBeNull();
    });
  });

  // ── Core DTO structure ───────────────────────────────────────────────────────

  describe('core DTO', () => {
    it('returns DTO with task populated', async () => {
      const result = await useCase.execute(TASK_ID);
      expect(result).not.toBeNull();
      expect(result!.task).toEqual(TASK);
    });

    it('returns taskDetail containing task fields plus rich arrays', async () => {
      const result = await useCase.execute(TASK_ID);
      expect(result!.taskDetail).toMatchObject({
        ...TASK,
        dependencyTasks: [],
        delayReasons: [],
        progressLogs: [],
        linkedQuotations: [],
      });
    });

    it('fetches documents from DocumentRepository', async () => {
      const result = await useCase.execute(TASK_ID);
      expect(result!.documents[0].id).toEqual(DOCUMENT.id);
      expect(mockDocumentRepo.findByTaskId).toHaveBeenCalledWith(TASK_ID);
    });

    it('fetches all parallel data in a single call', async () => {
      await useCase.execute(TASK_ID);
      expect(mockTaskRepo.findDependencies).toHaveBeenCalledWith(TASK_ID);
      expect(mockTaskRepo.findDelayReasons).toHaveBeenCalledWith(TASK_ID);
      expect(mockTaskRepo.findProgressLogs).toHaveBeenCalledWith(TASK_ID);
      expect(mockQuotationRepo.findByTask).toHaveBeenCalledWith(TASK_ID);
      expect(mockTaskRepo.findDependents).toHaveBeenCalledWith(TASK_ID);
      expect(mockDocumentRepo.findByTaskId).toHaveBeenCalledWith(TASK_ID);
    });
  });

  // ── nextInLine ───────────────────────────────────────────────────────────────

  describe('nextInLine', () => {
    it('returns empty array when task has no dependents', async () => {
      const result = await useCase.execute(TASK_ID);
      expect(result!.nextInLine).toEqual([]);
    });

    it('slices nextInLine to a maximum of 3 dependents', async () => {
      const deps = [
        { id: 't2', title: 'Task 2', status: 'pending' },
        { id: 't3', title: 'Task 3', status: 'pending' },
        { id: 't4', title: 'Task 4', status: 'pending' },
        { id: 't5', title: 'Task 5', status: 'pending' },
      ];
      mockTaskRepo.findDependents.mockResolvedValue(deps);

      const result = await useCase.execute(TASK_ID);
      expect(result!.nextInLine).toHaveLength(3);
      expect(result!.nextInLine[0].id).toBe('t2');
    });

    it('returns all dependents when there are 3 or fewer', async () => {
      const deps = [
        { id: 't2', title: 'Task 2', status: 'pending' },
        { id: 't3', title: 'Task 3', status: 'pending' },
      ];
      mockTaskRepo.findDependents.mockResolvedValue(deps);
      const result = await useCase.execute(TASK_ID);
      expect(result!.nextInLine).toHaveLength(2);
    });
  });

  // ── subcontractorInfo ────────────────────────────────────────────────────────

  describe('subcontractorInfo', () => {
    it('maps subcontractorId to SubcontractorInfo via ContactRepository', async () => {
      const result = await useCase.execute(TASK_ID);
      expect(result!.subcontractorInfo).toEqual({
        id: 'contact-1',
        name: 'Bob Builder',
        trade: 'Flooring',
        phone: '0400000001',
        email: 'bob@builder.com',
      });
      expect(mockContactRepo.findById).toHaveBeenCalledWith('contact-1');
    });

    it('sets subcontractorInfo to null when task has no subcontractorId', async () => {
      mockTaskRepo.findById.mockResolvedValue({ ...TASK, subcontractorId: undefined });
      const result = await useCase.execute(TASK_ID);
      expect(result!.subcontractorInfo).toBeNull();
      expect(mockContactRepo.findById).not.toHaveBeenCalled();
    });

    it('sets subcontractorInfo to null when contact is not found', async () => {
      mockContactRepo.findById.mockResolvedValue(null);
      const result = await useCase.execute(TASK_ID);
      expect(result!.subcontractorInfo).toBeNull();
    });

    it('handles ContactRepository.findById failure gracefully', async () => {
      mockContactRepo.findById.mockRejectedValue(new Error('DB error'));
      const result = await useCase.execute(TASK_ID);
      expect(result!.subcontractorInfo).toBeNull();
    });

    it('maps optional contact fields when present', async () => {
      const contactWithAllFields = {
        id: 'contact-1',
        name: 'Alice Architect',
        trade: 'Architecture',
        phone: '0411111111',
        email: 'alice@arch.com',
      };
      mockContactRepo.findById.mockResolvedValue(contactWithAllFields);
      const result = await useCase.execute(TASK_ID);
      expect(result!.subcontractorInfo).toMatchObject({
        id: 'contact-1',
        name: 'Alice Architect',
        trade: 'Architecture',
        phone: '0411111111',
        email: 'alice@arch.com',
      });
    });
  });

  // ── linkedInvoice ────────────────────────────────────────────────────────────

  describe('linkedInvoice', () => {
    it('sets linkedInvoice to null when quoteInvoiceId is not set', async () => {
      const result = await useCase.execute(TASK_ID);
      expect(result!.linkedInvoice).toBeNull();
      expect(mockInvoiceRepo.getInvoice).not.toHaveBeenCalled();
    });

    it('fetches linkedInvoice when quoteInvoiceId is set', async () => {
      const invoice = { id: 'inv-1', total: 1500, status: 'unpaid' };
      mockTaskRepo.findById.mockResolvedValue({ ...TASK, quoteInvoiceId: 'inv-1' });
      mockInvoiceRepo.getInvoice.mockResolvedValue(invoice);

      const result = await useCase.execute(TASK_ID);
      expect(result!.linkedInvoice).toEqual(invoice);
      expect(mockInvoiceRepo.getInvoice).toHaveBeenCalledWith('inv-1');
    });

    it('handles InvoiceRepository.getInvoice failure gracefully', async () => {
      mockTaskRepo.findById.mockResolvedValue({ ...TASK, quoteInvoiceId: 'inv-1' });
      mockInvoiceRepo.getInvoice.mockRejectedValue(new Error('DB error'));

      const result = await useCase.execute(TASK_ID);
      expect(result!.linkedInvoice).toBeNull();
    });
  });

  // ── hasQuotationRecord ───────────────────────────────────────────────────────

  describe('hasQuotationRecord', () => {
    it('sets hasQuotationRecord=false when quoteAmount is null', async () => {
      const result = await useCase.execute(TASK_ID);
      expect(result!.hasQuotationRecord).toBe(false);
      expect(mockQuotationRepo.listQuotations).not.toHaveBeenCalled();
    });

    it('does not check quotations when quoteInvoiceId is already set', async () => {
      mockTaskRepo.findById.mockResolvedValue({
        ...TASK,
        quoteInvoiceId: 'inv-1',
        quoteAmount: 1500,
      });
      await useCase.execute(TASK_ID);
      expect(mockQuotationRepo.listQuotations).not.toHaveBeenCalled();
    });

    it('sets hasQuotationRecord=true when a matching quotation exists', async () => {
      mockTaskRepo.findById.mockResolvedValue({ ...TASK, quoteAmount: 1500 });
      mockQuotationRepo.listQuotations.mockResolvedValue({
        items: [{ id: 'q-1', total: 1500 }],
        total: 1,
      });

      const result = await useCase.execute(TASK_ID);
      expect(result!.hasQuotationRecord).toBe(true);
      expect(mockQuotationRepo.listQuotations).toHaveBeenCalledWith({
        projectId: 'proj-1',
        limit: 50,
      });
    });

    it('sets hasQuotationRecord=false when no quotation total matches quoteAmount', async () => {
      mockTaskRepo.findById.mockResolvedValue({ ...TASK, quoteAmount: 1500 });
      mockQuotationRepo.listQuotations.mockResolvedValue({
        items: [{ id: 'q-1', total: 2000 }],
        total: 1,
      });

      const result = await useCase.execute(TASK_ID);
      expect(result!.hasQuotationRecord).toBe(false);
    });

    it('sets hasQuotationRecord=false when quotation list is empty', async () => {
      mockTaskRepo.findById.mockResolvedValue({ ...TASK, quoteAmount: 1500 });
      mockQuotationRepo.listQuotations.mockResolvedValue({ items: [], total: 0 });

      const result = await useCase.execute(TASK_ID);
      expect(result!.hasQuotationRecord).toBe(false);
    });

    it('handles QuotationRepository.listQuotations failure gracefully', async () => {
      mockTaskRepo.findById.mockResolvedValue({ ...TASK, quoteAmount: 1500 });
      mockQuotationRepo.listQuotations.mockRejectedValue(new Error('DB error'));

      const result = await useCase.execute(TASK_ID);
      expect(result!.hasQuotationRecord).toBe(false);
    });
  });
});
