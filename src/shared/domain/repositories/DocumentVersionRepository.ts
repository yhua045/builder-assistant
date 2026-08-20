import type { DocumentVersion } from '../entities/DocumentVersion';

export interface DocumentVersionRepository {
  create(version: DocumentVersion): Promise<DocumentVersion>;
  getLatestByDocumentId(documentId: string): Promise<DocumentVersion | null>;
  getById(versionId: string): Promise<DocumentVersion | null>;
  update(versionId: string, patch: Partial<DocumentVersion>): Promise<DocumentVersion>;
}
