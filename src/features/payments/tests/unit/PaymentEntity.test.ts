import { PaymentEntity } from '../../../../domain/entities/Payment';

describe('PaymentEntity', () => {
  it('creates a payment entity with id and timestamps', () => {
    const payload = { projectId: 'p1', amount: 123 } as any;
    const entity = PaymentEntity.create(payload);
    const data = entity.data();

    expect(typeof data.id).toBe('string');
    expect(data.createdAt).toBeDefined();
    expect(data.updatedAt).toBeDefined();
  });
});
