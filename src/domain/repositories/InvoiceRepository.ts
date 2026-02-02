import { Invoice } from '../entities/Invoice';

export interface InvoiceRepository {
  save(invoice: Invoice): Promise<void>;
  findById(id: string): Promise<Invoice | null>;
  findAll(): Promise<Invoice[]>;
  findByProjectId(projectId: string): Promise<Invoice[]>;
  findUnpaidByProject(projectId: string): Promise<Invoice[]>;
  update(invoice: Invoice): Promise<void>;
  delete(id: string): Promise<void>;
}
