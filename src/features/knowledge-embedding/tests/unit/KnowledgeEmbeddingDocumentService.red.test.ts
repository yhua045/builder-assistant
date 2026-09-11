import { KnowledgeEmbeddingDocumentService } from '../../application/services/KnowledgeEmbeddingDocumentService';
import type { AddKnowledgeEmbeddingDocumentCommand } from '../../application/contracts/KnowledgeEmbeddingRunContracts';

describe('KnowledgeEmbeddingDocumentService red contract', () => {
  const command: AddKnowledgeEmbeddingDocumentCommand = {
    documentId: 'doc-pending-1',
    documentVersion: 1,
    metadata: {
      name: 'engineering-plan.pdf',
      type: 'engineering',
      size: '2 MB',
      uri: 'file:///tmp/engineering-plan.pdf',
      contentHash: 'same-content-hash',
    },
  };

  it('atomically persists a new document and returns its pending run', async () => {
    const service = new KnowledgeEmbeddingDocumentService();

    const result = await service.addDocument(command);

    expect(result.alreadyHandled).toBe(false);
    expect(result.run.documentId).toBe(command.documentId);
    expect(result.run.status).toBe('pending');
  });

  it('returns the persisted document list with processing status and errors', async () => {
    const service = new KnowledgeEmbeddingDocumentService();

    await service.addDocument(command);

    const documents = await service.listDocuments();

    expect(documents).toEqual(expect.arrayContaining([
      expect.objectContaining({
        documentId: 'doc-pending-1',
        status: expect.any(String),
        retryCount: expect.any(Number),
      }),
    ]));
  });

  it('persists duplicate documents but reuses the existing RAG workflow', async () => {
    const service = new KnowledgeEmbeddingDocumentService();

    await service.addDocument(command);
    const duplicate = await service.addDocument({
      ...command,
      documentId: 'doc-duplicate-1',
      metadata: { ...command.metadata, name: 'renamed-plan.pdf' },
    });

    expect(duplicate.alreadyHandled).toBe(true);
    expect(duplicate.run.documentId).toBe('doc-duplicate-1');
    expect((await service.listDocuments()).map((document) => document.documentId))
      .toEqual(expect.arrayContaining(['doc-pending-1', 'doc-duplicate-1']));
  });

  it('restores interrupted work and exposes it for resume or manual retry', async () => {
    const service = new KnowledgeEmbeddingDocumentService();

    await service.addDocument(command);
    await service.updateStatus('run-doc-pending-1-1', 'running', 'embedding');

    const documents = await service.restoreAndResume();

    expect(documents).toEqual(expect.arrayContaining([
      expect.objectContaining({
        documentId: expect.any(String),
        resumeFromCheckpoint: expect.any(Boolean),
      }),
    ]));
  });

  it('removes a document atomically and treats an absent document as idempotent', async () => {
    const service = new KnowledgeEmbeddingDocumentService();

    await expect(service.removeDocument('missing-document', 1)).resolves.toBeUndefined();
  });
});
