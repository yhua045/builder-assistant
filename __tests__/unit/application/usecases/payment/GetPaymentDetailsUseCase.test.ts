/**
 * Unit tests for GetPaymentDetailsUseCase
 * Design: design/issue-210-get-payment-details-usecase.md §6.1
 *
 * Acceptance criteria covered:
 * - Invoice-entry path: resolves invoice, builds synthetic payment, fetches project, isSyntheticRow: true
 * - Invoice-entry path — no project: returns project: null when invoice.projectId is undefined
 * - Payment-entry path: resolves payment, fetches invoice + linkedPayments in parallel, fetches project, isSyntheticRow: false
 * - Payment-entry path — payment not found: returns payment: null in DTO (no throw)
 * - Synthetic-row path: skips paymentRepo fetch, fetches invoice and project, isSyntheticRow: true
 * - Synthetic-row — no invoiceId: returns invoice: null, linkedPayments: [], project: null
 * - All three paths call repos with correct arguments
 */

import { GetPaymentDetailsUseCase } from '../../../../../src/application/usecases/payment/GetPaymentDetailsUseCase';
import { Payment } from '../../../../../src/domain/entities/Payment';
import { Invoice } from '../../../../../src/domain/entities/Invoice';
import { Project } from '../../../../../src/domain/entities/Project';
import { PaymentRepository } from '../../../../../src/domain/repositories/PaymentRepository';
import { InvoiceRepository } from '../../../../../src/domain/repositories/InvoiceRepository';
import { ProjectRepository } from '../../../../../src/domain/repositories/ProjectRepository';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const PAYMENT: Payment = {
  id: 'pay-001',
  invoiceId: 'inv-1',
  projectId: 'proj-1',
  amount: 500,
  status: 'pending',
  contractorName: 'Acme Builders',
};

const SETTLED_PAYMENT: Payment = {
  id: 'pay-002',
  invoiceId: 'inv-1',
  projectId: 'proj-1',
  amount: 200,
  status: 'settled',
  contractorName: 'Acme Builders',
};

const INVOICE: Invoice = {
  id: 'inv-1',
  projectId: 'proj-1',
  total: 1000,
  status: 'issued',
  paymentStatus: 'unpaid',
  currency: 'AUD',
  dateIssued: '2026-01-01',
  dateDue: '2026-02-01',
  issuerName: 'Acme Builders',
} as unknown as Invoice;

const INVOICE_NO_PROJECT: Invoice = {
  ...INVOICE,
  id: 'inv-no-proj',
  projectId: undefined,
} as unknown as Invoice;

const PROJECT: Project = {
  id: 'proj-1',
  name: 'House Reno',
  status: 'in_progress',
  materials: [],
  phases: [],
} as unknown as Project;

const SYNTHETIC_ROW: Payment = {
  id: 'invoice-payable:inv-1',
  invoiceId: 'inv-1',
  projectId: 'proj-1',
  amount: 1000,
  status: 'pending',
  contractorName: 'Invoice Payable',
};

// ── Mock repos ────────────────────────────────────────────────────────────────

let mockPaymentRepo: jest.Mocked<
  Pick<PaymentRepository, 'findById' | 'findByInvoice'>
>;
let mockInvoiceRepo: jest.Mocked<Pick<InvoiceRepository, 'getInvoice'>>;
let mockProjectRepo: jest.Mocked<Pick<ProjectRepository, 'findById'>>;

beforeEach(() => {
  mockPaymentRepo = {
    findById: jest.fn().mockResolvedValue(PAYMENT),
    findByInvoice: jest.fn().mockResolvedValue([PAYMENT, SETTLED_PAYMENT]),
  };

  mockInvoiceRepo = {
    getInvoice: jest.fn().mockResolvedValue(INVOICE),
  };

  mockProjectRepo = {
    findById: jest.fn().mockResolvedValue(PROJECT),
  };
});

function makeUseCase() {
  return new GetPaymentDetailsUseCase(
    mockPaymentRepo as unknown as PaymentRepository,
    mockInvoiceRepo as unknown as InvoiceRepository,
    mockProjectRepo as unknown as ProjectRepository,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GetPaymentDetailsUseCase', () => {
  // ── Invoice-entry path ───────────────────────────────────────────────────

  describe('invoice-entry path ({ invoiceId })', () => {
    it('calls invoiceRepo.getInvoice and paymentRepo.findByInvoice with the correct invoiceId', async () => {
      const uc = makeUseCase();
      await uc.execute({ invoiceId: 'inv-1' });

      expect(mockInvoiceRepo.getInvoice).toHaveBeenCalledWith('inv-1');
      expect(mockPaymentRepo.findByInvoice).toHaveBeenCalledWith('inv-1');
    });

    it('constructs a synthetic Payment with the correct id prefix and outstanding amount', async () => {
      mockPaymentRepo.findByInvoice.mockResolvedValue([SETTLED_PAYMENT]); // 200 settled
      const uc = makeUseCase();
      const dto = await uc.execute({ invoiceId: 'inv-1' });

      // outstanding = 1000 - 200 = 800
      expect(dto.payment).not.toBeNull();
      expect(dto.payment!.id).toBe('invoice-payable:inv-1');
      expect(dto.payment!.amount).toBe(800);
      expect(dto.payment!.contractorName).toBe('Acme Builders'); // from issuerName
    });

    it('sets isSyntheticRow: true', async () => {
      const uc = makeUseCase();
      const dto = await uc.execute({ invoiceId: 'inv-1' });
      expect(dto.isSyntheticRow).toBe(true);
    });

    it('fetches the project via invoice.projectId and returns it in the DTO', async () => {
      const uc = makeUseCase();
      const dto = await uc.execute({ invoiceId: 'inv-1' });

      expect(mockProjectRepo.findById).toHaveBeenCalledWith('proj-1');
      expect(dto.project).toEqual(PROJECT);
    });

    it('returns project: null when invoice.projectId is undefined', async () => {
      mockInvoiceRepo.getInvoice.mockResolvedValue(INVOICE_NO_PROJECT);
      const uc = makeUseCase();
      const dto = await uc.execute({ invoiceId: 'inv-no-proj' });

      expect(mockProjectRepo.findById).not.toHaveBeenCalled();
      expect(dto.project).toBeNull();
    });

    it('returns invoice and linkedPayments in the DTO', async () => {
      mockPaymentRepo.findByInvoice.mockResolvedValue([SETTLED_PAYMENT]);
      const uc = makeUseCase();
      const dto = await uc.execute({ invoiceId: 'inv-1' });

      expect(dto.invoice).toEqual(INVOICE);
      expect(dto.linkedPayments).toEqual([SETTLED_PAYMENT]);
    });

    it('returns payment: null and isSyntheticRow: false when invoice is not found', async () => {
      mockInvoiceRepo.getInvoice.mockResolvedValue(null);
      const uc = makeUseCase();
      const dto = await uc.execute({ invoiceId: 'inv-missing' });

      expect(dto.payment).toBeNull();
      expect(dto.isSyntheticRow).toBe(false);
    });
  });

  // ── Payment-entry path ───────────────────────────────────────────────────

  describe('payment-entry path ({ paymentId })', () => {
    it('calls paymentRepo.findById with the correct paymentId', async () => {
      const uc = makeUseCase();
      await uc.execute({ paymentId: 'pay-001' });

      expect(mockPaymentRepo.findById).toHaveBeenCalledWith('pay-001');
    });

    it('fetches invoice and linkedPayments in parallel when payment has an invoiceId', async () => {
      const uc = makeUseCase();
      await uc.execute({ paymentId: 'pay-001' });

      expect(mockInvoiceRepo.getInvoice).toHaveBeenCalledWith('inv-1');
      expect(mockPaymentRepo.findByInvoice).toHaveBeenCalledWith('inv-1');
    });

    it('excludes the resolved payment itself from linkedPayments', async () => {
      mockPaymentRepo.findByInvoice.mockResolvedValue([PAYMENT, SETTLED_PAYMENT]);
      const uc = makeUseCase();
      const dto = await uc.execute({ paymentId: 'pay-001' });

      // PAYMENT (pay-001) is the resolved payment, so it's excluded from linkedPayments
      expect(dto.linkedPayments.find((p) => p.id === 'pay-001')).toBeUndefined();
      expect(dto.linkedPayments.find((p) => p.id === 'pay-002')).toBeDefined();
    });

    it('fetches the project via payment.projectId', async () => {
      const uc = makeUseCase();
      const dto = await uc.execute({ paymentId: 'pay-001' });

      expect(mockProjectRepo.findById).toHaveBeenCalledWith('proj-1');
      expect(dto.project).toEqual(PROJECT);
    });

    it('sets isSyntheticRow: false', async () => {
      const uc = makeUseCase();
      const dto = await uc.execute({ paymentId: 'pay-001' });
      expect(dto.isSyntheticRow).toBe(false);
    });

    it('returns payment: null when paymentRepo.findById returns null (not found)', async () => {
      mockPaymentRepo.findById.mockResolvedValue(null);
      const uc = makeUseCase();
      const dto = await uc.execute({ paymentId: 'pay-missing' });

      expect(dto.payment).toBeNull();
      expect(dto.invoice).toBeNull();
      expect(dto.linkedPayments).toEqual([]);
      expect(dto.project).toBeNull();
    });

    it('does not fetch invoice or project when payment has no invoiceId or projectId', async () => {
      mockPaymentRepo.findById.mockResolvedValue({
        id: 'pay-standalone',
        amount: 750,
        status: 'pending',
      } as Payment);
      const uc = makeUseCase();
      const dto = await uc.execute({ paymentId: 'pay-standalone' });

      expect(mockInvoiceRepo.getInvoice).not.toHaveBeenCalled();
      expect(mockProjectRepo.findById).not.toHaveBeenCalled();
      expect(dto.invoice).toBeNull();
      expect(dto.project).toBeNull();
    });
  });

  // ── Synthetic-row path ───────────────────────────────────────────────────

  describe('synthetic-row path ({ syntheticRow })', () => {
    it('does NOT call paymentRepo.findById', async () => {
      const uc = makeUseCase();
      await uc.execute({ syntheticRow: SYNTHETIC_ROW });

      expect(mockPaymentRepo.findById).not.toHaveBeenCalled();
    });

    it('uses syntheticRow as the payment in the DTO', async () => {
      const uc = makeUseCase();
      const dto = await uc.execute({ syntheticRow: SYNTHETIC_ROW });

      expect(dto.payment).toEqual(SYNTHETIC_ROW);
    });

    it('fetches invoice and linkedPayments when syntheticRow has an invoiceId', async () => {
      const uc = makeUseCase();
      await uc.execute({ syntheticRow: SYNTHETIC_ROW });

      expect(mockInvoiceRepo.getInvoice).toHaveBeenCalledWith('inv-1');
      expect(mockPaymentRepo.findByInvoice).toHaveBeenCalledWith('inv-1');
    });

    it('fetches project via invoice.projectId', async () => {
      const uc = makeUseCase();
      const dto = await uc.execute({ syntheticRow: SYNTHETIC_ROW });

      expect(mockProjectRepo.findById).toHaveBeenCalledWith('proj-1');
      expect(dto.project).toEqual(PROJECT);
    });

    it('sets isSyntheticRow: true (id starts with "invoice-payable:")', async () => {
      const uc = makeUseCase();
      const dto = await uc.execute({ syntheticRow: SYNTHETIC_ROW });
      expect(dto.isSyntheticRow).toBe(true);
    });

    it('returns invoice: null, linkedPayments: [], project: null when syntheticRow has no invoiceId', async () => {
      const noInvoiceRow: Payment = {
        id: 'invoice-payable:no-inv',
        amount: 500,
        status: 'pending',
      };
      const uc = makeUseCase();
      const dto = await uc.execute({ syntheticRow: noInvoiceRow });

      expect(mockInvoiceRepo.getInvoice).not.toHaveBeenCalled();
      expect(dto.invoice).toBeNull();
      expect(dto.linkedPayments).toEqual([]);
      expect(dto.project).toBeNull();
    });
  });

  // ── Derived fields ───────────────────────────────────────────────────────

  describe('derived fields', () => {
    it('totalSettled is sum of linkedPayments with status=settled', async () => {
      mockPaymentRepo.findByInvoice.mockResolvedValue([PAYMENT, SETTLED_PAYMENT]);
      const uc = makeUseCase();
      const dto = await uc.execute({ invoiceId: 'inv-1' });

      expect(dto.totalSettled).toBe(200);
    });

    it('remainingBalance is invoice.total - totalSettled', async () => {
      mockPaymentRepo.findByInvoice.mockResolvedValue([SETTLED_PAYMENT]); // 200 settled
      const uc = makeUseCase();
      const dto = await uc.execute({ invoiceId: 'inv-1' }); // invoice.total = 1000

      expect(dto.remainingBalance).toBe(800);
    });

    it('remainingBalance is 0 when invoice is null', async () => {
      mockPaymentRepo.findById.mockResolvedValue({ id: 'pay-standalone', amount: 750, status: 'pending' } as Payment);
      const uc = makeUseCase();
      const dto = await uc.execute({ paymentId: 'pay-standalone' });

      expect(dto.remainingBalance).toBe(0);
    });

    it('canRecordPayment is true for unpaid invoice with remaining balance > 0', async () => {
      mockPaymentRepo.findByInvoice.mockResolvedValue([]);
      const uc = makeUseCase();
      const dto = await uc.execute({ invoiceId: 'inv-1' });

      expect(dto.canRecordPayment).toBe(true);
    });

    it('canRecordPayment is false when invoice.status is cancelled', async () => {
      mockInvoiceRepo.getInvoice.mockResolvedValue({ ...INVOICE, status: 'cancelled' } as unknown as Invoice);
      mockPaymentRepo.findByInvoice.mockResolvedValue([]);
      const uc = makeUseCase();
      const dto = await uc.execute({ invoiceId: 'inv-1' });

      expect(dto.canRecordPayment).toBe(false);
    });

    it('canRecordPayment is false when remainingBalance is 0', async () => {
      mockPaymentRepo.findByInvoice.mockResolvedValue([{ ...SETTLED_PAYMENT, amount: 1000 }]); // fully settled
      const uc = makeUseCase();
      const dto = await uc.execute({ invoiceId: 'inv-1' });

      expect(dto.canRecordPayment).toBe(false);
    });

    it('isPending is true for a pending payment', async () => {
      // PAYMENT.status = 'pending'
      const uc = makeUseCase();
      const dto = await uc.execute({ paymentId: 'pay-001' });

      expect(dto.isPending).toBe(true);
    });

    it('isPending is false for a settled payment', async () => {
      mockPaymentRepo.findById.mockResolvedValue({ ...PAYMENT, status: 'settled' });
      const uc = makeUseCase();
      const dto = await uc.execute({ paymentId: 'pay-001' });

      expect(dto.isPending).toBe(false);
    });

    it('resolvedProjectId is invoice.projectId for synthetic rows', async () => {
      mockPaymentRepo.findByInvoice.mockResolvedValue([]);
      const uc = makeUseCase();
      const dto = await uc.execute({ invoiceId: 'inv-1' });

      expect(dto.isSyntheticRow).toBe(true);
      expect(dto.resolvedProjectId).toBe('proj-1');
    });

    it('resolvedProjectId is payment.projectId for standalone payments', async () => {
      const uc = makeUseCase();
      const dto = await uc.execute({ paymentId: 'pay-001' });

      expect(dto.isSyntheticRow).toBe(false);
      expect(dto.resolvedProjectId).toBe('proj-1');
    });
  });
});
