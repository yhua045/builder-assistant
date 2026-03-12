import { Payment } from '../entities/Payment';

export interface PaymentFilters {
  projectId?: string;
  invoiceId?: string;
  status?: 'pending' | 'settled';
  fromDate?: string; // ISO
  toDate?: string; // ISO
  isOverdue?: boolean; // special filter: status = pending and dueDate < now
  limit?: number;
  offset?: number;
  // Added in #142
  allProjects?: boolean;        // if true, projectId is ignored — queries across all projects
  contractorSearch?: string;    // case-insensitive partial match on contractor_name
  paymentCategory?: 'contract' | 'variation' | 'other';
}

export interface PaymentListResult {
  items: Payment[];
  meta: { total: number; limit?: number; offset?: number };
}

export interface PaymentMetrics {
  pendingTotalNext7Days: number;
  overdueCount: number;
}

export interface PaymentRepository {
  save(payment: Payment): Promise<void>;
  findById(id: string): Promise<Payment | null>;
  findAll(): Promise<Payment[]>;
  findByInvoice(invoiceId: string): Promise<Payment[]>;
  findByProjectId(projectId: string): Promise<Payment[]>;
  findPendingByProject(projectId: string): Promise<Payment[]>;
  update(payment: Payment): Promise<void>;
  delete(id: string): Promise<void>;

  // Flexible list API used by UI and use-cases
  list(filters: PaymentFilters): Promise<PaymentListResult>;

  // Aggregates needed by KPIs
  getMetrics(projectId?: string): Promise<PaymentMetrics>;

  /** Sum of all pending payment amounts globally, optionally filtered by contractor name. */
  getGlobalAmountPayable(contractorSearch?: string): Promise<number>;
}
