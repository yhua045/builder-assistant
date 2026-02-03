import { Inspection } from '../entities/Inspection';

export interface InspectionRepository {
  save(inspection: Inspection): Promise<void>;
  findById(id: string): Promise<Inspection | null>;
  findAll(): Promise<Inspection[]>;
  findByProjectId(projectId: string): Promise<Inspection[]>;
  findPendingByProject(projectId: string): Promise<Inspection[]>;
  update(inspection: Inspection): Promise<void>;
  delete(id: string): Promise<void>;
}
