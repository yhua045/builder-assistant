import { Invoice } from '../entities/Invoice';

export interface InvoiceFilterParams {
  projectId?: string;
  status?: Invoice['status'][];
  dateRange?: { start: string; end: string };
  limit?: number;
  offset?: number;
}

export interface InvoiceRepository {
  // Core CRUD
  createInvoice(invoice: Invoice): Promise<Invoice>;
  getInvoice(id: string): Promise<Invoice | null>;
  updateInvoice(id: string, updates: Partial<Invoice>): Promise<Invoice>;
  deleteInvoice(id: string): Promise<void>; 

  // Search & List
  findByExternalKey(externalId: string, externalReference: string): Promise<Invoice | null>;
  listInvoices(params?: InvoiceFilterParams): Promise<{ items: Invoice[]; total: number }>;
  
  // Business Operations
  assignProject(invoiceId: string, projectId: string): Promise<Invoice>;

  // Legacy/Convenience (optional, kept if matches existing patterns, otherwise can be removed)
  // findByProjectId(projectId: string): Promise<Invoice[]>; 
}
