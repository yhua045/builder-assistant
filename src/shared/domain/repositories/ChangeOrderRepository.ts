import { ChangeOrder } from '../entities/ChangeOrder.ts';

export interface ChangeOrderRepository {
  save(changeOrder: ChangeOrder): Promise<void>;
  findById(id: string): Promise<ChangeOrder | null>;
  findAll(): Promise<ChangeOrder[]>;
  findByProjectId(projectId: string): Promise<ChangeOrder[]>;
  update(changeOrder: ChangeOrder): Promise<void>;
  delete(id: string): Promise<void>;
}
