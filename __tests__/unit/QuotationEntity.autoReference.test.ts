import { QuotationEntity } from '../../src/domain/entities/Quotation';

describe('QuotationEntity.create() — auto-reference generation', () => {
  const basePayload = {
    date: '2026-03-27',
    total: 100,
  };

  it('auto-generates a reference when reference is empty string', () => {
    const entity = QuotationEntity.create({ ...basePayload, reference: '' } as any);
    expect(entity.data().reference).toMatch(/^QUO-\d{8}-[A-Z0-9]{6}$/);
  });

  it('auto-generates a reference when reference is undefined', () => {
    const entity = QuotationEntity.create({ ...basePayload } as any);
    expect(entity.data().reference).toMatch(/^QUO-\d{8}-[A-Z0-9]{6}$/);
  });

  it('auto-generates a reference when reference is null', () => {
    const entity = QuotationEntity.create({ ...basePayload, reference: null } as any);
    expect(entity.data().reference).toMatch(/^QUO-\d{8}-[A-Z0-9]{6}$/);
  });

  it('uses the provided reference when not blank', () => {
    const entity = QuotationEntity.create({
      ...basePayload,
      reference: 'QT-CUSTOM-001',
    });
    expect(entity.data().reference).toBe('QT-CUSTOM-001');
  });

  it('uses the provided reference when it contains whitespace-padded characters', () => {
    // Only whitespace → treated as blank → auto-generate
    const entity = QuotationEntity.create({
      ...basePayload,
      reference: '   ',
    } as any);
    expect(entity.data().reference).toMatch(/^QUO-\d{8}-[A-Z0-9]{6}$/);
  });

  it('generated reference YYYYMMDD matches the payload date field', () => {
    const entity = QuotationEntity.create({
      ...basePayload,
      date: '2026-03-27',
      reference: '',
    } as any);
    expect(entity.data().reference).toContain('20260327');
  });

  it('generated reference falls back to today when reference is blank and date is today', () => {
    // This verifies: when no explicit reference AND date is today,
    // the auto-generated reference prefix matches today's date
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const entity = QuotationEntity.create({
      date: new Date().toISOString().slice(0, 10),
      total: 100,
    } as any);
    expect(entity.data().reference).toContain(today);
  });

  it('generated suffix is uppercase alphanumeric 6 chars', () => {
    const entity = QuotationEntity.create({ ...basePayload, reference: '' } as any);
    const suffix = entity.data().reference.split('-').pop()!;
    expect(suffix).toMatch(/^[A-Z0-9]{6}$/);
  });

  it('two auto-generated references are unique', () => {
    const entity1 = QuotationEntity.create({ ...basePayload, reference: '' } as any);
    const entity2 = QuotationEntity.create({ ...basePayload, reference: '' } as any);
    // Very unlikely to collide due to random suffix
    expect(entity1.data().reference).not.toBe(entity2.data().reference);
  });
});
