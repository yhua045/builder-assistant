import { Document } from '../entities/Document';

export interface DocumentRepository {
  save(document: Document): Promise<void>;
  findById(id: string): Promise<Document | null>;
  findAll(filter?: { projectId?: string; status?: string }): Promise<Document[]>;
  findByProjectId(projectId: string): Promise<Document[]>;
  update(document: Document): Promise<void>;
  delete(id: string): Promise<void>;
  assignProject(documentId: string, projectId: string): Promise<void>;
}
