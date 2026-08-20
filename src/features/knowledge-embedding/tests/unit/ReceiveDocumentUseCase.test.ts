import { ReceiveDocumentUseCase } from '../../application/ReceiveDocumentUseCase';
import type { DocumentChunkingWorkflowRecord, DocumentChunkingWorkflowRepository } from '../../../../shared/domain/repositories/DocumentChunkingWorkflowRepository';

class MockWorkflowRepository implements DocumentChunkingWorkflowRepository {
  records: DocumentChunkingWorkflowRecord[] = [];

  async upsert(record: DocumentChunkingWorkflowRecord): Promise<void> {
    this.records.push({ ...record, updatedAt: record.updatedAt ?? Date.now() });
  }

  async findByDocumentVersion(documentId: string, version: number): Promise<DocumentChunkingWorkflowRecord | null> {
    return this.records.find(record => record.documentId === documentId && record.documentVersion === version) ?? null;
  }

  async findLatestByDocumentId(documentId: string): Promise<DocumentChunkingWorkflowRecord | null> {
    const matches = this.records.filter(record => record.documentId === documentId);
    matches.sort((a, b) => b.documentVersion - a.documentVersion || b.updatedAt - a.updatedAt);
    return matches[0] ?? null;
  }

  async findByStatus(status: string): Promise<DocumentChunkingWorkflowRecord[]> {
    return this.records.filter(record => record.status === status);
  }
}

describe('ReceiveDocumentUseCase', () => {
  it('creates a document and first version in the received state', async () => {
    const repository = new MockWorkflowRepository();
    const useCase = new ReceiveDocumentUseCase(repository);

    const result = await useCase.execute({
      sessionId: 'session-1',
      projectId: 'project-1',
      originalFileName: 'invoice.pdf',
      sourceType: 'pdf',
      mimeType: 'application/pdf',
      storageKey: 'files/invoice.pdf',
      checksum: 'abc123',
    });

    expect(result.status).toBe('received');
    expect(result.workflowState).toBe('document_received');
    expect(result.documentId).toBeTruthy();
    expect(result.documentVersionId).toBeTruthy();
    expect(result.version).toBe(1);
    expect(repository.records[0].status).toBe('received');
  });

  it('preserves project and source metadata on creation', async () => {
    const repository = new MockWorkflowRepository();
    const useCase = new ReceiveDocumentUseCase(repository);

    const result = await useCase.execute({
      sessionId: 'session-2',
      projectId: 'project-9',
      originalFileName: 'permit.png',
      sourceType: 'image',
      mimeType: 'image/png',
      storageKey: 'files/permit.png',
      checksum: 'xyz789',
    });

    expect(result.documentId).toBeTruthy();
    expect(result.documentVersionId).toBeTruthy();
    expect(result.version).toBe(1);
    expect(repository.records).toHaveLength(1);
  });

  it('handles missing optional metadata without throwing', async () => {
    const repository = new MockWorkflowRepository();
    const useCase = new ReceiveDocumentUseCase(repository);

    await expect(
      useCase.execute({
        sessionId: 'session-3',
        originalFileName: 'notes.txt',
        sourceType: 'text',
        storageKey: 'files/notes.txt',
      }),
    ).resolves.toMatchObject({
      status: 'received',
      workflowState: 'document_received',
    });
    expect(repository.records[0].status).toBe('received');
  });
});
