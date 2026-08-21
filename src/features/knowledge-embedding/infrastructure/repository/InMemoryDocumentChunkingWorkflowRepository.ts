import type {
  DocumentChunkingWorkflowRecord,
  DocumentChunkingWorkflowRepository,
} from '../../../../shared/domain/repositories/DocumentChunkingWorkflowRepository';

export class InMemoryDocumentChunkingWorkflowRepository implements DocumentChunkingWorkflowRepository {
  private readonly records = new Map<string, DocumentChunkingWorkflowRecord>();

  async upsert(record: DocumentChunkingWorkflowRecord): Promise<void> {
    const key = `${record.documentId}:${record.documentVersion}`;
    const nextRecord = {
      ...record,
      updatedAt: record.updatedAt ?? Date.now(),
      createdAt: record.createdAt ?? Date.now(),
    };

    this.records.set(key, nextRecord);
  }

  async findByDocumentVersion(documentId: string, version: number): Promise<DocumentChunkingWorkflowRecord | null> {
    return this.records.get(`${documentId}:${version}`) ?? null;
  }

  async findLatestByDocumentId(documentId: string): Promise<DocumentChunkingWorkflowRecord | null> {
    const matches = [...this.records.values()].filter(record => record.documentId === documentId);
    matches.sort((a, b) => b.documentVersion - a.documentVersion || b.updatedAt - a.updatedAt);
    return matches[0] ?? null;
  }

  async findByStatus(status: string): Promise<DocumentChunkingWorkflowRecord[]> {
    return [...this.records.values()].filter(record => record.status === status);
  }
}
