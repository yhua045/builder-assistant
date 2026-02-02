import { Milestone } from '../entities/Milestone';

export interface MilestoneRepository {
  save(milestone: Milestone): Promise<void>;
  findById(id: string): Promise<Milestone | null>;
  findAll(): Promise<Milestone[]>;
  findByProjectId(projectId: string): Promise<Milestone[]>;
  update(milestone: Milestone): Promise<void>;
  delete(id: string): Promise<void>;
}
