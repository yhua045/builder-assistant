import {
  resolveVendorDetails,
  VendorResolutionContext,
} from '../../src/domain/services/VendorDetailsResolver';
import { Contact } from '../../src/domain/entities/Contact';
import { Quotation } from '../../src/domain/entities/Quotation';

const makeContact = (overrides: Partial<Contact> = {}): Contact => ({
  id: 'contact-1',
  name: 'Bob Builder',
  email: 'bob@builder.com',
  address: '123 Construction St',
  phone: '0400 000 000',
  ...overrides,
});

const makeQuotation = (overrides: Partial<Quotation> = {}): Quotation => ({
  id: 'quot-1',
  reference: 'QT-2026-001',
  date: new Date().toISOString(),
  currency: 'AUD',
  total: 10000,
  status: 'sent',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

describe('resolveVendorDetails', () => {
  // ── Priority 1: Contact ─────────────────────────────────────────────────

  it('returns contact details when contact is provided', () => {
    const contact = makeContact();
    const ctx: VendorResolutionContext = { contact };
    const result = resolveVendorDetails(ctx);

    expect(result.source).toBe('contact');
    expect(result.vendorId).toBe('contact-1');
    expect(result.vendorName).toBe('Bob Builder');
    expect(result.vendorAddress).toBe('123 Construction St');
    expect(result.vendorEmail).toBe('bob@builder.com');
    expect(result.vendorPhone).toBe('0400 000 000');
  });

  it('uses contact even when quotation is also provided', () => {
    const contact = makeContact({ name: 'Contact Name' });
    const quotation = makeQuotation({ vendorName: 'Doc Vendor Name' });
    const ctx: VendorResolutionContext = { contact, quotation };
    const result = resolveVendorDetails(ctx);

    expect(result.source).toBe('contact');
    expect(result.vendorName).toBe('Contact Name');
  });

  it('handles contact with only required fields (no optional address/email)', () => {
    const contact = makeContact({ address: undefined, email: undefined, phone: undefined });
    const ctx: VendorResolutionContext = { contact };
    const result = resolveVendorDetails(ctx);

    expect(result.source).toBe('contact');
    expect(result.vendorName).toBe('Bob Builder');
    expect(result.vendorAddress).toBeUndefined();
    expect(result.vendorEmail).toBeUndefined();
    expect(result.vendorPhone).toBeUndefined();
  });

  // ── Priority 2: Quotation document ─────────────────────────────────────

  it('falls back to quotation document when no contact', () => {
    const quotation = makeQuotation({
      vendorId: 'ext-vendor-1',
      vendorName: 'Acme Roofing Pty Ltd',
      vendorAddress: '456 Supplier Ave',
      vendorEmail: 'info@acmeroofing.com',
    });
    const ctx: VendorResolutionContext = { quotation };
    const result = resolveVendorDetails(ctx);

    expect(result.source).toBe('quotation_document');
    expect(result.vendorId).toBe('ext-vendor-1');
    expect(result.vendorName).toBe('Acme Roofing Pty Ltd');
    expect(result.vendorAddress).toBe('456 Supplier Ave');
    expect(result.vendorEmail).toBe('info@acmeroofing.com');
  });

  it('uses quotation contactId alias when vendorId is absent', () => {
    const quotation = makeQuotation({ contactId: 'alias-contact-id', vendorName: 'Alias Corp' });
    const ctx: VendorResolutionContext = { contact: null, quotation };
    const result = resolveVendorDetails(ctx);

    expect(result.source).toBe('quotation_document');
    expect(result.vendorId).toBe('alias-contact-id');
  });

  it('skips quotation when vendorName is blank', () => {
    const quotation = makeQuotation({ vendorName: '   ' });
    const ctx: VendorResolutionContext = { contact: null, quotation };
    const result = resolveVendorDetails(ctx);

    expect(result.source).toBe('unknown');
  });

  it('skips quotation when vendorName is undefined', () => {
    const quotation = makeQuotation({ vendorName: undefined });
    const ctx: VendorResolutionContext = { contact: null, quotation };
    const result = resolveVendorDetails(ctx);

    expect(result.source).toBe('unknown');
  });

  // ── Priority 3: OCR extracted ───────────────────────────────────────────

  it('falls back to OCR extracted fields when no contact and no quotation vendorName', () => {
    const ocrExtracted = {
      vendorName: 'OCR Corp',
      vendorAddress: '789 Scanned Rd',
      vendorEmail: 'ocr@corp.com',
    };
    const ctx: VendorResolutionContext = { contact: null, quotation: null, ocrExtracted };
    const result = resolveVendorDetails(ctx);

    expect(result.source).toBe('ocr');
    expect(result.vendorName).toBe('OCR Corp');
    expect(result.vendorAddress).toBe('789 Scanned Rd');
    expect(result.vendorEmail).toBe('ocr@corp.com');
    expect(result.vendorId).toBeUndefined();
  });

  it('skips OCR when vendorName is blank', () => {
    const ctx: VendorResolutionContext = {
      contact: null,
      quotation: null,
      ocrExtracted: { vendorName: '' },
    };
    const result = resolveVendorDetails(ctx);
    expect(result.source).toBe('unknown');
  });

  // ── Fallback: unknown ───────────────────────────────────────────────────

  it('returns unknown fallback when no data sources are available', () => {
    const ctx: VendorResolutionContext = {};
    const result = resolveVendorDetails(ctx);

    expect(result.source).toBe('unknown');
    expect(result.vendorName).toBe('Unknown Vendor');
    expect(result.vendorId).toBeUndefined();
    expect(result.vendorAddress).toBeUndefined();
  });

  it('returns unknown when all sources are explicitly null/undefined', () => {
    const ctx: VendorResolutionContext = {
      contact: null,
      quotation: null,
      ocrExtracted: null,
    };
    const result = resolveVendorDetails(ctx);
    expect(result.source).toBe('unknown');
    expect(result.vendorName).toBe('Unknown Vendor');
  });

  // ── vendorName is never empty ───────────────────────────────────────────

  it('vendorName is always a non-empty string regardless of source', () => {
    const sources: VendorResolutionContext[] = [
      { contact: makeContact() },
      { quotation: makeQuotation({ vendorName: 'X' }) },
      { ocrExtracted: { vendorName: 'Y' } },
      {},
    ];
    for (const ctx of sources) {
      const result = resolveVendorDetails(ctx);
      expect(typeof result.vendorName).toBe('string');
      expect(result.vendorName.length).toBeGreaterThan(0);
    }
  });
});
