import { ValidateDocumentUseCase } from '../../application/usecases/ValidateDocumentUseCase';
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

describe('ValidateDocumentUseCase', () => {
  it('passes a supported PDF file', async () => {
    const repository = new MockWorkflowRepository();
    const useCase = new ValidateDocumentUseCase(repository);

    const result = await useCase.execute({
      documentId: 'doc-1',
      documentVersionId: 'version-1',
      sessionId: 'session-1',
      storageKey: 'files/invoice.pdf',
      sourceType: 'pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: 250_000,
    });

    expect(result.isSupported).toBe(true);
    expect(result.status).toBe('passed');
    expect(result.validationStatus).toBe('passed');
    expect(result.updatedVersion.validationStatus).toBe('passed');
    expect(result.updatedVersion.supportedForAnalysis).toBe(true);
    expect(repository.records[0].workflowState).toBe('validation_passed');
  });

  it('fails unsupported file extensions', async () => {
    const repository = new MockWorkflowRepository();
    const useCase = new ValidateDocumentUseCase(repository);

    const result = await useCase.execute({
      documentId: 'doc-2',
      documentVersionId: 'version-2',
      storageKey: 'files/archive.csv',
      sourceType: 'text',
      mimeType: 'text/csv',
      fileSizeBytes: 10_000,
    });

    expect(result.isSupported).toBe(false);
    expect(result.status).toBe('failed');
    expect(result.rejectionCode).toBe('unsupported_file_type');
    expect(result.updatedVersion.workflowState).toBe('validation_failed');
    expect(repository.records[0].status).toBe('failed');
  });

  it('fails empty files', async () => {
    const repository = new MockWorkflowRepository();
    const useCase = new ValidateDocumentUseCase(repository);

    const result = await useCase.execute({
      documentId: 'doc-3',
      documentVersionId: 'version-3',
      storageKey: 'files/empty.pdf',
      sourceType: 'pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: 0,
    });

    expect(result.isSupported).toBe(false);
    expect(result.rejectionCode).toBe('empty_document');
    expect(result.updatedVersion.validationStatus).toBe('failed');
    expect(repository.records[0].workflowState).toBe('validation_failed');
  });

  it('fails unreadable missing files', async () => {
    const repository = new MockWorkflowRepository();
    const useCase = new ValidateDocumentUseCase(repository);

    const result = await useCase.execute({
      documentId: 'doc-4',
      documentVersionId: 'version-4',
      storageKey: 'files/missing.pdf',
      sourceType: 'pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: 250_000,
    });

    expect(result.isSupported).toBe(false);
    expect(result.rejectionCode).toBe('cannot_read_file');
    expect(result.updatedVersion.workflowState).toBe('validation_failed');
    expect(repository.records[0].status).toBe('failed');
  });

  it('fails oversized files', async () => {
    const repository = new MockWorkflowRepository();
    const useCase = new ValidateDocumentUseCase(repository);

    const result = await useCase.execute({
      documentId: 'doc-5',
      documentVersionId: 'version-5',
      storageKey: 'files/large.pdf',
      sourceType: 'pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: 200 * 1024 * 1024,
    });

    expect(result.isSupported).toBe(false);
    expect(result.rejectionCode).toBe('document_too_large');
    expect(result.updatedVersion.validationStatus).toBe('failed');
    expect(repository.records[0].workflowState).toBe('validation_failed');
  });
});
