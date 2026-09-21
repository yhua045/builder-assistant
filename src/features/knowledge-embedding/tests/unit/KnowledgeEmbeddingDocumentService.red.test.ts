import { KnowledgeEmbeddingDocumentService } from '../../document-intake/application/services/KnowledgeEmbeddingDocumentService';
import type { AddKnowledgeEmbeddingDocumentCommand } from '../../document-intake/application/contracts/DocumentIntakeContracts';
import type { Document } from '../../../../shared/domain/entities/Document';
import type { DocumentRepository } from '../../../../shared/domain/repositories/DocumentRepository';
import type { DocumentChunkingWorkflowRecord, DocumentChunkingWorkflowRepository } from '../../../../shared/domain/repositories/DocumentChunkingWorkflowRepository';
import { InMemoryWorkflowQueue } from '../../workflow/application/services/InMemoryWorkflowQueue';

class TestDocumentRepository implements DocumentRepository {
  readonly documents = new Map<string, Document>();

  async save(document: Document): Promise<void> {
    this.documents.set(document.id, { ...document });
  }

  async findById(id: string): Promise<Document | null> {
    return this.documents.get(id) ?? null;
  }

  async findAll(filter?: { projectId?: string; status?: string; checksum?: string }): Promise<Document[]> {
    return [...this.documents.values()].filter((document) =>
      (!filter?.projectId || document.projectId === filter.projectId) &&
      (!filter?.status || document.status === filter.status) &&
      (!filter?.checksum || document.checksum === filter.checksum),
    );
  }

  async findByProjectId(projectId: string): Promise<Document[]> {
    return this.findAll({ projectId });
  }

  async findByTaskId(taskId: string): Promise<Document[]> {
    return [...this.documents.values()].filter((document) => document.taskId === taskId);
  }

  async update(document: Document): Promise<void> {
    return this.save(document);
  }

  async delete(id: string): Promise<void> {
    this.documents.delete(id);
  }

  async assignProject(documentId: string, projectId: string): Promise<void> {
    const document = await this.findById(documentId);
    if (document) await this.save({ ...document, projectId });
  }
}

class TestWorkflowRepository implements DocumentChunkingWorkflowRepository {
  readonly records = new Map<string, DocumentChunkingWorkflowRecord>();

  async upsert(record: DocumentChunkingWorkflowRecord): Promise<void> {
    this.records.set(`${record.documentId}:${record.documentVersion}`, { ...record });
  }

  async findByDocumentVersion(documentId: string, version: number): Promise<DocumentChunkingWorkflowRecord | null> {
    return this.records.get(`${documentId}:${version}`) ?? null;
  }

  async findLatestByDocumentId(documentId: string): Promise<DocumentChunkingWorkflowRecord | null> {
    return [...this.records.values()]
      .filter((record) => record.documentId === documentId)
      .sort((left, right) => right.documentVersion - left.documentVersion)[0] ?? null;
  }

  async findByStatus(status: string): Promise<DocumentChunkingWorkflowRecord[]> {
    return [...this.records.values()].filter((record) => record.status === status);
  }
}

function makeWorkflowRecord(status: string, documentId = 'doc-source-1'): DocumentChunkingWorkflowRecord {
  return {
    id: `run-${documentId}`,
    documentId,
    documentVersion: 1,
    status,
    workflowState: status === 'completed' ? 'completed' : 'embedding',
    retryCount: 0,
    circuitOpen: false,
    resumeFromCheckpoint: status === 'partial',
    createdAt: 1,
    updatedAt: 1,
  };
}

function makeSourceDocument(): Document {
  return {
    id: 'doc-source-1',
    projectId: 'project-1',
    filename: 'engineering-plan.pdf',
    title: 'engineering-plan.pdf',
    status: 'local-only',
    checksum: 'same-content-hash',
    uri: 'file:///tmp/engineering-plan.pdf',
  };
}

function makeDuplicateCommand(documentId: string): AddKnowledgeEmbeddingDocumentCommand {
  return {
    documentId,
    documentVersion: 1,
    projectId: 'project-1',
    metadata: {
      name: 'renamed-plan.pdf',
      type: 'engineering',
      size: '2 MB',
      uri: 'file:///tmp/renamed-plan.pdf',
      contentHash: 'same-content-hash',
    },
  };
}

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

  it.each(['pending', 'running'])('treats a %s matching workflow as a queued duplicate', async (status) => {
    const documentRepository = new TestDocumentRepository();
    const workflowRepository = new TestWorkflowRepository();
    const queue = new InMemoryWorkflowQueue();
    await documentRepository.save(makeSourceDocument());
    await workflowRepository.upsert(makeWorkflowRecord(status));
    const service = new KnowledgeEmbeddingDocumentService({ documentRepository, workflowRepository, queue });

    const duplicate = await service.addDocument(makeDuplicateCommand(`doc-queued-${status}`));

    expect(duplicate.alreadyHandled).toBe(true);
    expect(queue.dequeue()).toBeUndefined();
    expect(await documentRepository.findById(`doc-queued-${status}`)).toBeNull();
    expect(duplicate.run.metadata.contentHash).toBe('same-content-hash');
  });

  it('reuses a completed matching workflow without publishing a queue item', async () => {
    const documentRepository = new TestDocumentRepository();
    const workflowRepository = new TestWorkflowRepository();
    const queue = new InMemoryWorkflowQueue();
    await documentRepository.save(makeSourceDocument());
    await workflowRepository.upsert(makeWorkflowRecord('completed'));
    const service = new KnowledgeEmbeddingDocumentService({ documentRepository, workflowRepository, queue });

    const duplicate = await service.addDocument(makeDuplicateCommand('doc-completed-duplicate'));

    expect(duplicate.alreadyHandled).toBe(true);
    expect(queue.dequeue()).toBeUndefined();
    expect((await documentRepository.findById('doc-completed-duplicate'))?.ragSourceDocumentId)
      .toBe('doc-source-1');
  });

  it('prefers a completed source when other same-checksum documents are still queued', async () => {
    const documentRepository = new TestDocumentRepository();
    const workflowRepository = new TestWorkflowRepository();
    const queue = new InMemoryWorkflowQueue();
    await documentRepository.save(makeSourceDocument());
    await documentRepository.save({ ...makeSourceDocument(), id: 'doc-queued-source' });
    await workflowRepository.upsert(makeWorkflowRecord('completed', 'doc-source-1'));
    await workflowRepository.upsert(makeWorkflowRecord('pending', 'doc-queued-source'));
    const service = new KnowledgeEmbeddingDocumentService({ documentRepository, workflowRepository, queue });

    const duplicate = await service.addDocument(makeDuplicateCommand('doc-completed-after-queued'));

    expect(duplicate.alreadyHandled).toBe(true);
    expect((await documentRepository.findById('doc-completed-after-queued'))?.ragSourceDocumentId)
      .toBe('doc-source-1');
    expect(queue.dequeue()).toBeUndefined();
  });

  it('does not block analysis when the completed checksum match belongs to another project', async () => {
    const documentRepository = new TestDocumentRepository();
    const workflowRepository = new TestWorkflowRepository();
    const queue = new InMemoryWorkflowQueue();
    await documentRepository.save({ ...makeSourceDocument(), projectId: 'project-2' });
    await workflowRepository.upsert(makeWorkflowRecord('completed'));
    const service = new KnowledgeEmbeddingDocumentService({ documentRepository, workflowRepository, queue });

    const duplicate = await service.addDocument(makeDuplicateCommand('doc-other-project'));

    expect(duplicate.alreadyHandled).toBe(false);
    expect(queue.dequeue()).toEqual({
      runId: 'run-doc-other-project-1',
      documentId: 'doc-other-project',
      documentVersion: 1,
    });
    expect((await documentRepository.findById('doc-other-project'))?.ragSourceDocumentId).toBeUndefined();
  });

  it.each(['failed', 'partial', 'cancelled'])('queues a new upload when the matching workflow is %s', async (status) => {
    const documentRepository = new TestDocumentRepository();
    const workflowRepository = new TestWorkflowRepository();
    const queue = new InMemoryWorkflowQueue();
    await documentRepository.save(makeSourceDocument());
    const sourceRecord = makeWorkflowRecord(status);
    await workflowRepository.upsert(sourceRecord);
    const service = new KnowledgeEmbeddingDocumentService({ documentRepository, workflowRepository, queue });

    const duplicate = await service.addDocument(makeDuplicateCommand(`doc-retry-${status}`));
    const queued = queue.dequeue();

    expect(duplicate.alreadyHandled).toBe(false);
    expect(queued).toEqual({
      runId: `run-doc-retry-${status}-1`,
      documentId: `doc-retry-${status}`,
      documentVersion: 1,
    });
    expect((await documentRepository.findById(`doc-retry-${status}`))?.ragSourceDocumentId).toBeUndefined();
    expect(await workflowRepository.findByDocumentVersion('doc-source-1', 1)).toEqual(sourceRecord);
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
