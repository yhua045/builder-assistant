import { Payment } from '../../../../domain/entities/Payment';
import { Invoice } from '../../../../domain/entities/Invoice';
import { PaymentRepository } from '../../../../domain/repositories/PaymentRepository';
import { InvoiceRepository } from '../../../../domain/repositories/InvoiceRepository';
import { ListProjectPaymentsFeedUseCase } from '../../application/ListProjectPaymentsFeedUseCase';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: `pay_${Math.random().toString(36).slice(2)}`,
    amount: 1000,
    status: 'pending',
    ...overrides,
  };
}

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: `inv_${Math.random().toString(36).slice(2)}`,
    total: 2000,
    currency: 'AUD',
    status: 'issued',
    paymentStatus: 'unpaid',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makePaymentRepo(payments: Payment[]): jest.Mocked<PaymentRepository> {
  return {
    findByProjectId: jest.fn().mockResolvedValue(payments),
    save: jest.fn(),
    findById: jest.fn(),
    findAll: jest.fn(),
    findByInvoice: jest.fn(),
    findPendingByProject: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    list: jest.fn(),
    getMetrics: jest.fn(),
    getGlobalAmountPayable: jest.fn(),
  } as unknown as jest.Mocked<PaymentRepository>;
}

function makeInvoiceRepo(invoices: Invoice[]): jest.Mocked<InvoiceRepository> {
  return {
    listInvoices: jest.fn().mockResolvedValue({ items: invoices, total: invoices.length }),
    createInvoice: jest.fn(),
    getInvoice: jest.fn(),
    updateInvoice: jest.fn(),
    deleteInvoice: jest.fn(),
    findByExternalKey: jest.fn(),
    assignProject: jest.fn(),
  } as unknown as jest.Mocked<InvoiceRepository>;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ListProjectPaymentsFeedUseCase', () => {
  const projectId = 'proj-abc';

  // U1: 2 unlinked payments + 1 issued invoice → 3 items
  it('U1: returns all unlinked payments and all invoices as feed items', async () => {
    const payments = [makePayment({ projectId }), makePayment({ projectId })];
    const invoices = [makeInvoice({ projectId, status: 'issued', paymentStatus: 'unpaid' })];

    const paymentRepo = makePaymentRepo(payments);
    const invoiceRepo = makeInvoiceRepo(invoices);

    const uc = new ListProjectPaymentsFeedUseCase(paymentRepo, invoiceRepo);
    const result = await uc.execute(projectId);

    expect(result.items).toHaveLength(3);
    const invoiceItems = result.items.filter((i) => i.kind === 'invoice');
    expect(invoiceItems).toHaveLength(1);
    expect(invoiceItems[0].kind).toBe('invoice');
  });

  // U2: draft + paid invoice → both included (all statuses)
  it('U2: includes invoices of any status (draft and paid)', async () => {
    const invoices = [
      makeInvoice({ projectId, status: 'draft' }),
      makeInvoice({ projectId, status: 'paid' }),
    ];
    const uc = new ListProjectPaymentsFeedUseCase(makePaymentRepo([]), makeInvoiceRepo(invoices));
    const result = await uc.execute(projectId);

    expect(result.items).toHaveLength(2);
    expect(result.items.every((i) => i.kind === 'invoice')).toBe(true);
  });

  // U3: payment with invoiceId excluded; payment without invoiceId included
  it('U3: excludes linked payments (those with an invoiceId)', async () => {
    const linkedPayment = makePayment({ projectId, invoiceId: 'inv-x' });
    const unlinkedPayment = makePayment({ projectId, invoiceId: undefined });

    const uc = new ListProjectPaymentsFeedUseCase(
      makePaymentRepo([linkedPayment, unlinkedPayment]),
      makeInvoiceRepo([]),
    );
    const result = await uc.execute(projectId);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].kind).toBe('payment');
    expect((result.items[0].data as Payment).id).toBe(unlinkedPayment.id);
  });

  // U4: cancelled invoice included
  it('U4: includes cancelled invoices', async () => {
    const invoice = makeInvoice({ projectId, status: 'cancelled' });
    const uc = new ListProjectPaymentsFeedUseCase(makePaymentRepo([]), makeInvoiceRepo([invoice]));
    const result = await uc.execute(projectId);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].kind).toBe('invoice');
  });

  // U5: overdue invoice with paymentStatus: 'partial'
  it('U5: includes overdue invoice with partial payment status', async () => {
    const invoice = makeInvoice({ projectId, status: 'overdue', paymentStatus: 'partial' });
    const uc = new ListProjectPaymentsFeedUseCase(makePaymentRepo([]), makeInvoiceRepo([invoice]));
    const result = await uc.execute(projectId);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].kind).toBe('invoice');
    if (result.items[0].kind === 'invoice') {
      expect(result.items[0].data.paymentStatus).toBe('partial');
    }
  });

  // U6: 501 combined items → truncated to 500
  it('U6: truncates to 500 items and sets truncated: true', async () => {
    // 300 unique payments + 201 invoices = 501 combined
    const payments = Array.from({ length: 300 }, (_, i) =>
      makePayment({ id: `pay_${i}`, projectId }),
    );
    const invoices = Array.from({ length: 201 }, (_, i) =>
      makeInvoice({ id: `inv_${i}`, projectId }),
    );
    const uc = new ListProjectPaymentsFeedUseCase(makePaymentRepo(payments), makeInvoiceRepo(invoices));
    const result = await uc.execute(projectId);

    expect(result.items).toHaveLength(500);
    expect(result.truncated).toBe(true);
  });

  // U7: items sorted ascending by due date; no-date items trail
  it('U7: sorts items ascending by due date with no-date items trailing', async () => {
    const laterPayment = makePayment({ projectId, dueDate: '2026-04-20' });
    const earlierInvoice = makeInvoice({ projectId, dateDue: '2026-04-10' });
    const nodatePayment = makePayment({ projectId, dueDate: undefined, date: undefined });

    const uc = new ListProjectPaymentsFeedUseCase(
      makePaymentRepo([laterPayment, nodatePayment]),
      makeInvoiceRepo([earlierInvoice]),
    );
    const result = await uc.execute(projectId);

    expect(result.items).toHaveLength(3);
    // earlier invoice first
    expect(result.items[0].kind).toBe('invoice');
    // later payment second
    expect(result.items[1].kind).toBe('payment');
    // no-date payment trails
    expect(result.items[2].kind).toBe('payment');
    expect((result.items[2].data as Payment).id).toBe(nodatePayment.id);
  });

  // U8: no data → empty result
  it('U8: returns empty items when project has no invoices or payments', async () => {
    const uc = new ListProjectPaymentsFeedUseCase(makePaymentRepo([]), makeInvoiceRepo([]));
    const result = await uc.execute(projectId);

    expect(result.items).toHaveLength(0);
    expect(result.truncated).toBe(false);
  });

  // Verify the use case calls repos with correct projectId
  it('calls paymentRepo.findByProjectId with the given projectId', async () => {
    const paymentRepo = makePaymentRepo([]);
    const invoiceRepo = makeInvoiceRepo([]);
    const uc = new ListProjectPaymentsFeedUseCase(paymentRepo, invoiceRepo);

    await uc.execute(projectId);

    expect(paymentRepo.findByProjectId).toHaveBeenCalledWith(projectId);
    expect(invoiceRepo.listInvoices).toHaveBeenCalledWith({ projectId });
  });
});
