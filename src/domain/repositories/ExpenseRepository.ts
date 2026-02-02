import { Expense } from '../entities/Expense';

export interface ExpenseRepository {
  save(expense: Expense): Promise<void>;
  findById(id: string): Promise<Expense | null>;
  findAll(): Promise<Expense[]>;
  findByProjectId(projectId: string): Promise<Expense[]>;
  findDraftsByProject(projectId: string): Promise<Expense[]>;
  update(expense: Expense): Promise<void>;
  delete(id: string): Promise<void>;
}
