import { TaskCompletionValidator } from '../../src/application/usecases/task/TaskCompletionValidator';
import { QuotationRepository } from '../../src/domain/repositories/QuotationRepository';
import { Quotation } from '../../src/domain/entities/Quotation';

function makeQuotation(overrides: Partial<Quotation> = {}): Quotation {
  return {
    id: 'quot-1',
    reference: 'QT-2026-001',
    date: '2026-01-15',
    total: 1000,
    currency: 'USD',
    status: 'draft',
    createdAt: '2026-01-15T00:00:00.000Z',
    updatedAt: '2026-01-15T00:00:00.000Z',
    ...overrides,
  };
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

describe('TaskCompletionValidator', () => {
  // T-1: No quotations → ok: true
  it('returns ok: true when there are no linked quotations', async () => {
    const repo = makeMockQuotationRepo([]);
    const validator = new TaskCompletionValidator(repo);

    const result = await validator.validate('task-1');

    expect(result.ok).toBe(true);
    expect(result.pendingQuotations).toHaveLength(0);
  });

  // T-2: All quotations accepted → ok: true
  it('returns ok: true when all linked quotations are accepted', async () => {
    const repo = makeMockQuotationRepo([
      makeQuotation({ id: 'q-1', status: 'accepted' }),
    ]);
    const validator = new TaskCompletionValidator(repo);

    const result = await validator.validate('task-1');

    expect(result.ok).toBe(true);
    expect(result.pendingQuotations).toHaveLength(0);
  });

  // T-3: All quotations declined → ok: true
  it('returns ok: true when all linked quotations are declined', async () => {
    const repo = makeMockQuotationRepo([
      makeQuotation({ id: 'q-1', status: 'declined' }),
    ]);
    const validator = new TaskCompletionValidator(repo);

    const result = await validator.validate('task-1');

    expect(result.ok).toBe(true);
    expect(result.pendingQuotations).toHaveLength(0);
  });

  // T-4: Mix of accepted + declined → ok: true
  it('returns ok: true when quotations are mix of accepted and declined', async () => {
    const repo = makeMockQuotationRepo([
      makeQuotation({ id: 'q-1', reference: 'QT-001', status: 'accepted' }),
      makeQuotation({ id: 'q-2', reference: 'QT-002', status: 'declined' }),
    ]);
    const validator = new TaskCompletionValidator(repo);

    const result = await validator.validate('task-1');

    expect(result.ok).toBe(true);
    expect(result.pendingQuotations).toHaveLength(0);
  });

  // T-5: One draft quotation → ok: false
  it('returns ok: false when a quotation is in draft status', async () => {
    const repo = makeMockQuotationRepo([
      makeQuotation({ id: 'q-1', reference: 'QT-001', status: 'draft' }),
    ]);
    const validator = new TaskCompletionValidator(repo);

    const result = await validator.validate('task-1');

    expect(result.ok).toBe(false);
    expect(result.pendingQuotations).toHaveLength(1);
    expect(result.pendingQuotations[0].status).toBe('draft');
  });

  // T-6: One sent quotation → ok: false
  it('returns ok: false when a quotation is in sent status', async () => {
    const repo = makeMockQuotationRepo([
      makeQuotation({ id: 'q-1', reference: 'QT-001', status: 'sent' }),
    ]);
    const validator = new TaskCompletionValidator(repo);

    const result = await validator.validate('task-1');

    expect(result.ok).toBe(false);
    expect(result.pendingQuotations).toHaveLength(1);
    expect(result.pendingQuotations[0].status).toBe('sent');
  });

  // T-7: Mix of draft + accepted → ok: false, only draft in pendingQuotations
  it('returns ok: false and only includes pending quotations in pendingQuotations', async () => {
    const repo = makeMockQuotationRepo([
      makeQuotation({ id: 'q-1', reference: 'QT-001', status: 'draft' }),
      makeQuotation({ id: 'q-2', reference: 'QT-002', status: 'accepted' }),
    ]);
    const validator = new TaskCompletionValidator(repo);

    const result = await validator.validate('task-1');

    expect(result.ok).toBe(false);
    expect(result.pendingQuotations).toHaveLength(1);
    expect(result.pendingQuotations[0].id).toBe('q-1');
  });

  // T-8: Soft-deleted draft is ignored → ok: true
  it('ignores soft-deleted quotations when validating', async () => {
    const repo = makeMockQuotationRepo([
      makeQuotation({
        id: 'q-1',
        status: 'draft',
        deletedAt: '2026-01-20T00:00:00.000Z',
      }),
    ]);
    const validator = new TaskCompletionValidator(repo);

    const result = await validator.validate('task-1');

    expect(result.ok).toBe(true);
    expect(result.pendingQuotations).toHaveLength(0);
  });

  // T-9: Multiple pending quotations → pendingQuotations has all of them
  it('returns all pending quotations when multiple are pending', async () => {
    const repo = makeMockQuotationRepo([
      makeQuotation({ id: 'q-1', reference: 'QT-001', status: 'draft' }),
      makeQuotation({ id: 'q-2', reference: 'QT-002', status: 'sent' }),
    ]);
    const validator = new TaskCompletionValidator(repo);

    const result = await validator.validate('task-1');

    expect(result.ok).toBe(false);
    expect(result.pendingQuotations).toHaveLength(2);
  });

  // Extra: pendingQuotations only exposes id, reference, status (not full entity)
  it('pendingQuotations only contains id, reference, and status fields', async () => {
    const repo = makeMockQuotationRepo([
      makeQuotation({
        id: 'q-1',
        reference: 'QT-001',
        status: 'draft',
        vendorName: 'Acme Corp',
        total: 9999,
      }),
    ]);
    const validator = new TaskCompletionValidator(repo);

    const result = await validator.validate('task-1');

    expect(result.pendingQuotations[0]).toEqual({
      id: 'q-1',
      reference: 'QT-001',
      status: 'draft',
    });
  });
});
