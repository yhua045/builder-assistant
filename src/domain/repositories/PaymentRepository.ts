import { Payment } from '../entities/Payment';

export interface PaymentRepository {
  save(payment: Payment): Promise<void>;
  findById(id: string): Promise<Payment | null>;
  findAll(): Promise<Payment[]>;
  findByProjectId(projectId: string): Promise<Payment[]>;
  findPendingByProject(projectId: string): Promise<Payment[]>;
  update(payment: Payment): Promise<void>;
  delete(id: string): Promise<void>;
}
