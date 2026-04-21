/**
 * Unit tests for AssignProjectToPaymentRecordUseCase
 *
 * Acceptance criteria:
 * - synthetic-invoice path: routes to invoiceRepo; checks status/paymentStatus guards
 * - synthetic-invoice path: calls assignProject when projectId is defined
 * - synthetic-invoice path: calls updateInvoice({ projectId: undefined }) when projectId is undefined
 * - synthetic-invoice path: throws when invoice not found
 * - synthetic-invoice path: throws InvoiceNotEditableError when invoice is cancelled
 * - synthetic-invoice path: throws InvoiceNotEditableError when invoice.paymentStatus is paid
 * - standalone-payment path: routes to paymentRepo; checks status guard
 * - standalone-payment path: calls paymentRepo.update with merged projectId
 * - standalone-payment path: throws when payment not found
 * - standalone-payment path: throws PaymentNotPendingError when payment is not pending
 */

import {
  AssignProjectToPaymentRecordUseCase,
  AssignProjectToPaymentRecordInput,
} from '../../../../../src/application/usecases/payment/AssignProjectToPaymentRecordUseCase';
import { PaymentNotPendingError, InvoiceNotEditableError } from '../../../../../src/application/errors/PaymentErrors';
import { PaymentRepository } from '../../../../../src/domain/repositories/PaymentRepository';
import { InvoiceRepository } from '../../../../../src/domain/repositories/InvoiceRepository';
import { Payment } from '../../../../../src/domain/entities/Payment';
import { Invoice } from '../../../../../src/domain/entities/Invoice';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const PENDING_PAYMENT: Payment = {
  id: 'pay-001',
  amount: 500,
  status: 'pending',
  projectId: undefined,
} as unknown as Payment;

const SETTLED_PAYMENT: Payment = {
  ...PENDING_PAYMENT,
  id: 'pay-002',
  status: 'settled',
};

const OPEN_INVOICE: Invoice = {
  id: 'inv-001',
  total: 1000,
  status: 'issued',
  paymentStatus: 'unpaid',
  projectId: undefined,
} as unknown as Invoice;

const CANCELLED_INVOICE: Invoice = { ...OPEN_INVOICE, id: 'inv-cancelled', status: 'cancelled' } as unknown as Invoice;
const PAID_INVOICE: Invoice = { ...OPEN_INVOICE, id: 'inv-paid', paymentStatus: 'paid' } as unknown as Invoice;

// ── Mock repos ────────────────────────────────────────────────────────────────

let mockPaymentRepo: jest.Mocked<Pick<PaymentRepository, 'findById' | 'update'>>;
let mockInvoiceRepo: jest.Mocked<Pick<InvoiceRepository, 'getInvoice' | 'assignProject' | 'updateInvoice'>>;

beforeEach(() => {
  mockPaymentRepo = {
    findById: jest.fn().mockResolvedValue(PENDING_PAYMENT),
    update: jest.fn().mockResolvedValue(undefined),
  };

  mockInvoiceRepo = {
    getInvoice: jest.fn().mockResolvedValue(OPEN_INVOICE),
    assignProject: jest.fn().mockResolvedValue(undefined),
    updateInvoice: jest.fn().mockResolvedValue(OPEN_INVOICE),
  };
});

function makeUseCase() {
  return new AssignProjectToPaymentRecordUseCase(
    mockPaymentRepo as unknown as PaymentRepository,
    mockInvoiceRepo as unknown as InvoiceRepository,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AssignProjectToPaymentRecordUseCase', () => {
  // ── synthetic-invoice path ───────────────────────────────────────────────

  describe('recordContext: synthetic-invoice', () => {
    const baseInput: AssignProjectToPaymentRecordInput = {
      recordContext: 'synthetic-invoice',
      targetId: 'inv-001',
      projectId: 'proj-1',
    };

    it('calls invoiceRepo.getInvoice with targetId', async () => {
      await makeUseCase().execute(baseInput);
      expect(mockInvoiceRepo.getInvoice).toHaveBeenCalledWith('inv-001');
    });

    it('calls invoiceRepo.assignProject when projectId is defined', async () => {
      await makeUseCase().execute(baseInput);
      expect(mockInvoiceRepo.assignProject).toHaveBeenCalledWith('inv-001', 'proj-1');
    });

    it('calls invoiceRepo.updateInvoice({ projectId: undefined }) when projectId is undefined', async () => {
      await makeUseCase().execute({ ...baseInput, projectId: undefined });
      expect(mockInvoiceRepo.updateInvoice).toHaveBeenCalledWith(
        'inv-001',
        expect.objectContaining({ projectId: undefined }),
      );
      expect(mockInvoiceRepo.assignProject).not.toHaveBeenCalled();
    });

    it('does NOT call paymentRepo at all', async () => {
      await makeUseCase().execute(baseInput);
      expect(mockPaymentRepo.findById).not.toHaveBeenCalled();
      expect(mockPaymentRepo.update).not.toHaveBeenCalled();
    });

    it('throws when invoice is not found', async () => {
      mockInvoiceRepo.getInvoice.mockResolvedValue(null);
      await expect(makeUseCase().execute(baseInput)).rejects.toThrow('Invoice not found: inv-001');
    });

    it('throws InvoiceNotEditableError when invoice.status is cancelled', async () => {
      mockInvoiceRepo.getInvoice.mockResolvedValue(CANCELLED_INVOICE);
      await expect(makeUseCase().execute({ ...baseInput, targetId: 'inv-cancelled' }))
        .rejects.toBeInstanceOf(InvoiceNotEditableError);
    });

    it('throws InvoiceNotEditableError when invoice.paymentStatus is paid', async () => {
      mockInvoiceRepo.getInvoice.mockResolvedValue(PAID_INVOICE);
      await expect(makeUseCase().execute({ ...baseInput, targetId: 'inv-paid' }))
        .rejects.toBeInstanceOf(InvoiceNotEditableError);
    });
  });

  // ── standalone-payment path ──────────────────────────────────────────────

  describe('recordContext: standalone-payment', () => {
    const baseInput: AssignProjectToPaymentRecordInput = {
      recordContext: 'standalone-payment',
      targetId: 'pay-001',
      projectId: 'proj-1',
    };

    it('calls paymentRepo.findById with targetId', async () => {
      await makeUseCase().execute(baseInput);
      expect(mockPaymentRepo.findById).toHaveBeenCalledWith('pay-001');
    });

    it('calls paymentRepo.update with merged projectId', async () => {
      await makeUseCase().execute(baseInput);
      expect(mockPaymentRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'pay-001', projectId: 'proj-1' }),
      );
    });

    it('calls paymentRepo.update with projectId: undefined to unlink', async () => {
      await makeUseCase().execute({ ...baseInput, projectId: undefined });
      expect(mockPaymentRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'pay-001', projectId: undefined }),
      );
    });

    it('does NOT call invoiceRepo at all', async () => {
      await makeUseCase().execute(baseInput);
      expect(mockInvoiceRepo.getInvoice).not.toHaveBeenCalled();
    });

    it('throws when payment is not found', async () => {
      mockPaymentRepo.findById.mockResolvedValue(null);
      await expect(makeUseCase().execute(baseInput)).rejects.toThrow('Payment not found: pay-001');
    });

    it('throws PaymentNotPendingError when payment is not pending', async () => {
      mockPaymentRepo.findById.mockResolvedValue(SETTLED_PAYMENT);
      await expect(makeUseCase().execute({ ...baseInput, targetId: 'pay-002' }))
        .rejects.toBeInstanceOf(PaymentNotPendingError);
    });
  });
});
