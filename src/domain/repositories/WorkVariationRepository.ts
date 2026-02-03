import { WorkVariation } from '../entities/WorkVariation';

export interface WorkVariationRepository {
  save(wv: WorkVariation): Promise<void>;
  findById(id: string): Promise<WorkVariation | null>;
  findAll(): Promise<WorkVariation[]>;
  findByProjectId(projectId: string): Promise<WorkVariation[]>;
  findOpenByProject(projectId: string): Promise<WorkVariation[]>;
  update(wv: WorkVariation): Promise<void>;
  delete(id: string): Promise<void>;
}
