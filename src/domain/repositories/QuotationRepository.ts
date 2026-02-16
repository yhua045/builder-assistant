import { Quotation } from '../entities/Quotation';

export interface QuotationFilterParams {
  projectId?: string;
  vendorId?: string;
  status?: Quotation['status'][];
  dateRange?: { start: string; end: string };
  limit?: number;
  offset?: number;
}

export interface QuotationRepository {
  // Core CRUD
  createQuotation(quotation: Quotation): Promise<Quotation>;
  getQuotation(id: string): Promise<Quotation | null>;
  updateQuotation(id: string, updates: Partial<Quotation>): Promise<Quotation>;
  deleteQuotation(id: string): Promise<void>; // Soft delete

  // Search & List
  findByReference(reference: string): Promise<Quotation | null>;
  listQuotations(params?: QuotationFilterParams): Promise<{ items: Quotation[]; total: number }>;
}
