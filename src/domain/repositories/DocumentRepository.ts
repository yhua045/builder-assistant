import { Document } from '../entities/Document';

export interface DocumentRepository {
  save(document: Document): Promise<void>;
  findById(id: string): Promise<Document | null>;
  findAll(): Promise<Document[]>;
  findByProjectId(projectId: string): Promise<Document[]>;
  update(document: Document): Promise<void>;
  delete(id: string): Promise<void>;
}
