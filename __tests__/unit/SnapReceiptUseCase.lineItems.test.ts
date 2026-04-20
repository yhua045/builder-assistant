import { SnapReceiptUseCase, SnapReceiptDTO } from '../../src/application/usecases/receipt/SnapReceiptUseCase';
import { Invoice } from '../../src/domain/entities/Invoice';
import { Payment } from '../../src/domain/entities/Payment';
import { ReceiptRepository } from '../../src/domain/repositories/ReceiptRepository';

function makeReceiptRepo(): jest.Mocked<ReceiptRepository> {
  return {
    createReceipt: jest.fn().mockResolvedValue({
      invoice: { id: 'inv-1', total: 150, currency: 'AUD', status: 'paid', paymentStatus: 'paid' } as Invoice,
      payment: { id: 'pay-1', amount: 150, method: 'card', status: 'settled', currency: 'AUD' } as Payment,
    }),
    createUnpaidInvoice: jest.fn(),
  } as jest.Mocked<ReceiptRepository>;
}

describe('SnapReceiptUseCase - lineItems persistence', () => {
  it('passes lineItems as JSON to invoiceEntity when present in DTO', async () => {
    const repo = makeReceiptRepo();
    const useCase = new SnapReceiptUseCase(repo);

    const dto: SnapReceiptDTO = {
      vendorId: 'vendor-1',
      vendor: 'Bunnings',
      amount: 136.36,  // equals sum of lineItems (90 + 46.36)
      date: new Date().toISOString(),
      paymentMethod: 'card',
      lineItems: [
        { description: 'Concrete blocks', quantity: 2, unitPrice: 45.0, total: 90.0 },
        { description: 'Gravel bags', quantity: 5, unitPrice: 9.27, total: 46.36 },
      ],
    };

    await useCase.execute(dto);

    const callArgs = repo.createReceipt.mock.calls[0];
    const invoice = callArgs[0];

    // lineItems should be serialized onto the invoice entity
    expect(invoice.lineItems).toBeDefined();
    expect(Array.isArray(invoice.lineItems)).toBe(true);
    expect(invoice.lineItems).toHaveLength(2);
    expect(invoice.lineItems![0]).toMatchObject({
      description: 'Concrete blocks',
      quantity: 2,
      unitPrice: 45.0,
      total: 90.0,
    });
  });

  it('passes no lineItems when DTO has no lineItems', async () => {
    const repo = makeReceiptRepo();
    const useCase = new SnapReceiptUseCase(repo);

    const dto: SnapReceiptDTO = {
      vendorId: 'vendor-1',
      vendor: 'Bunnings',
      amount: 150,
      date: new Date().toISOString(),
      paymentMethod: 'card',
    };

    await useCase.execute(dto);

    const callArgs = repo.createReceipt.mock.calls[0];
    const invoice = callArgs[0];

    expect(invoice.lineItems == null || invoice.lineItems.length === 0).toBe(true);
  });

  it('passes empty lineItems array when DTO has empty lineItems', async () => {
    const repo = makeReceiptRepo();
    const useCase = new SnapReceiptUseCase(repo);

    const dto: SnapReceiptDTO = {
      vendorId: 'vendor-1',
      vendor: 'Bunnings',
      amount: 150,
      date: new Date().toISOString(),
      paymentMethod: 'card',
      lineItems: [],
    };

    await useCase.execute(dto);

    const callArgs = repo.createReceipt.mock.calls[0];
    const invoice = callArgs[0];

    expect(invoice.lineItems == null || invoice.lineItems.length === 0).toBe(true);
  });
});
