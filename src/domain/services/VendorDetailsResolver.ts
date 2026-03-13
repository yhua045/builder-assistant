/**
 * VendorDetailsResolver — Domain Service
 *
 * Pure, I/O-free function that applies the vendor resolution priority chain.
 * Callers pre-fetch the available data; this service selects the best source.
 *
 * Priority:
 *   1. Contact record (resolved from subcontractorId)
 *   2. Quotation document fields (parsed from uploaded PDF)
 *   3. OCR-extracted fields (future Flow C)
 *   4. 'Unknown Vendor' fallback
 *
 * Values are FROZEN at resolution time (audit trail — Q2 decision).
 */

import { Contact } from '../entities/Contact';
import { Quotation } from '../entities/Quotation';

export interface ResolvedVendorDetails {
  /** Contact.id — set only when source is 'contact' */
  vendorId?: string;
  /** Display name; never empty — always has a fallback value */
  vendorName: string;
  vendorAddress?: string;
  vendorEmail?: string;
  vendorPhone?: string;
  source: 'contact' | 'quotation_document' | 'ocr' | 'unknown';
}

export interface VendorResolutionContext {
  /** Task.subcontractorId — used only for tracking; the Contact record holds the data */
  subcontractorId?: string;
  /** Pre-fetched Contact record. When present, takes highest priority. */
  contact?: Contact | null;
  /** Quotation document metadata (parsed vendor fields from an uploaded doc). */
  quotation?: Pick<
    Quotation,
    'vendorId' | 'vendorName' | 'vendorAddress' | 'vendorEmail' | 'contactId'
  > | null;
  /**
   * OCR-extracted vendor fields — reserved for Flow C (direct document upload).
   * Pass null/undefined until that feature is built.
   */
  ocrExtracted?: {
    vendorName?: string;
    vendorAddress?: string;
    vendorEmail?: string;
  } | null;
}

export function resolveVendorDetails(ctx: VendorResolutionContext): ResolvedVendorDetails {
  // ── Priority 1: Contact record ───────────────────────────────────────────
  if (ctx.contact) {
    return {
      vendorId: ctx.contact.id,
      vendorName: ctx.contact.name,
      vendorAddress: ctx.contact.address,
      vendorEmail: ctx.contact.email,
      vendorPhone: ctx.contact.phone,
      source: 'contact',
    };
  }

  // ── Priority 2: Quotation document fields ────────────────────────────────
  const qVendorName = ctx.quotation?.vendorName?.trim();
  if (qVendorName) {
    return {
      vendorId: ctx.quotation!.vendorId ?? ctx.quotation!.contactId,
      vendorName: qVendorName,
      vendorAddress: ctx.quotation!.vendorAddress,
      vendorEmail: ctx.quotation!.vendorEmail,
      source: 'quotation_document',
    };
  }

  // ── Priority 3: OCR-extracted fields (future Flow C) ─────────────────────
  const ocrName = ctx.ocrExtracted?.vendorName?.trim();
  if (ocrName) {
    return {
      vendorName: ocrName,
      vendorAddress: ctx.ocrExtracted!.vendorAddress,
      vendorEmail: ctx.ocrExtracted!.vendorEmail,
      source: 'ocr',
    };
  }

  // ── Fallback ─────────────────────────────────────────────────────────────
  return { vendorName: 'Unknown Vendor', source: 'unknown' };
}
