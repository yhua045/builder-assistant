import type {
  AddKnowledgeEmbeddingDocumentCommand,
  CommitKnowledgeEmbeddingDocumentsCommand,
  KnowledgeEmbeddingDocumentError,
  KnowledgeEmbeddingDocumentMutationResult,
  KnowledgeEmbeddingDocumentService as KnowledgeEmbeddingDocumentServiceContract,
  KnowledgeEmbeddingRunView,
} from '../contracts/KnowledgeEmbeddingRunContracts';
import type { KnowledgeEmbeddingRunStage, KnowledgeEmbeddingRunStatus } from '../../workflow/domain/entities/KnowledgeEmbeddingRun';
import type { Document } from '../../../../shared/domain/entities/Document';
import type { DocumentRepository } from '../../../../shared/domain/repositories/DocumentRepository';
import type { DocumentChunkingWorkflowRecord, DocumentChunkingWorkflowRepository } from '../../../../shared/domain/repositories/DocumentChunkingWorkflowRepository';
import type { IFileSystemAdapter } from '../../../../shared/infrastructure/files/IFileSystemAdapter';
import { InMemoryWorkflowQueue, type KnowledgeEmbeddingQueueItem } from '../../workflow/application/services/InMemoryWorkflowQueue';

interface DeletableWorkflowRepository extends DocumentChunkingWorkflowRepository {
  deleteByDocumentVersion?(documentId: string, version: number): Promise<void>;
}

export interface KnowledgeEmbeddingDocumentServiceDependencies {
  documentRepository?: DocumentRepository;
  workflowRepository?: DeletableWorkflowRepository;
  fileSystem?: IFileSystemAdapter;
  queue?: InMemoryWorkflowQueue;
}

class InMemoryWorkflowRepository implements DeletableWorkflowRepository {
  private readonly records = new Map<string, DocumentChunkingWorkflowRecord>();

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

  async deleteByDocumentVersion(documentId: string, version: number): Promise<void> {
    this.records.delete(`${documentId}:${version}`);
  }
}

class InMemoryDocumentRepository implements DocumentRepository {
  private readonly documents = new Map<string, Document>();

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
    return [...this.documents.values()].filter((document) => document.projectId === projectId);
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

class InMemoryFileSystemAdapter implements IFileSystemAdapter {
  private readonly files = new Set<string>();

  async copyToAppStorage(sourceUri: string, destinationFilename: string): Promise<string> {
    const destination = `file://${destinationFilename}`;
    this.files.add(destination);
    return destination;
  }

  async computeSha256(filePath: string): Promise<string> {
    return `test-sha256:${filePath}`;
  }

  async getDocumentsDirectory(): Promise<string> {
    return 'file://documents';
  }

  async exists(filePath: string): Promise<boolean> {
    return this.files.has(filePath);
  }

  async deleteFile(filePath: string): Promise<void> {
    this.files.delete(filePath);
  }
}

export class KnowledgeEmbeddingDocumentService implements KnowledgeEmbeddingDocumentServiceContract {
  private readonly documentRepository: DocumentRepository;
  private readonly workflowRepository: DeletableWorkflowRepository;
  private readonly fileSystem: IFileSystemAdapter;
  private readonly queue: InMemoryWorkflowQueue;

  constructor(deps: KnowledgeEmbeddingDocumentServiceDependencies = {}) {
    this.documentRepository = deps.documentRepository ?? new InMemoryDocumentRepository();
    this.workflowRepository = deps.workflowRepository ?? new InMemoryWorkflowRepository();
    this.fileSystem = deps.fileSystem ?? new InMemoryFileSystemAdapter();
    this.queue = deps.queue ?? new InMemoryWorkflowQueue();
  }

  async listDocuments(): Promise<KnowledgeEmbeddingRunView[]> {
    const documents = await this.documentRepository.findAll();
    const views: KnowledgeEmbeddingRunView[] = [];

    for (const document of documents) {
      const record = await this.workflowRepository.findLatestByDocumentId(document.id) ??
        (document.ragSourceDocumentId
          ? await this.workflowRepository.findLatestByDocumentId(document.ragSourceDocumentId)
          : null);
      if (record) views.push(this.toView(record, document, document.id));
    }

    return views;
  }

  async getRuns(documentIds: string[]): Promise<KnowledgeEmbeddingRunView[]> {
    const views: KnowledgeEmbeddingRunView[] = [];
    for (const documentId of documentIds) {
      const document = await this.documentRepository.findById(documentId);
      if (!document) continue;
      const record = await this.workflowRepository.findLatestByDocumentId(documentId) ??
        (document.ragSourceDocumentId
          ? await this.workflowRepository.findLatestByDocumentId(document.ragSourceDocumentId)
          : null);
      if (record) views.push(this.toView(record, document, documentId));
    }
    return views;
  }

  async commitDocuments(command: CommitKnowledgeEmbeddingDocumentsCommand): Promise<KnowledgeEmbeddingRunView[]> {
    if (command.files.length === 0) {
      throw new Error('At least one document is required');
    }

    console.info('[knowledge-embedding] committing selected documents', {
      projectId: command.projectId,
      documentCount: command.files.length,
      documentIds: command.files.map((file) => file.id),
    });
    const committed: KnowledgeEmbeddingRunView[] = [];
    for (const file of command.files) {
      if (!file.uri.trim() || !file.name.trim()) {
        throw new Error('Document URI and name are required');
      }

      const result = await this.addDocument({
        documentId: file.id,
        documentVersion: 1,
        projectId: command.projectId,
        metadata: {
          name: file.name,
          type: file.type,
          size: file.size,
          uri: file.uri,
          contentHash: undefined,
        },
      });
      committed.push(result.run);
      console.info('[knowledge-embedding] document commit completed', {
        documentId: result.run.documentId,
        runId: result.run.id,
        alreadyHandled: result.alreadyHandled,
      });
    }
    console.info('[knowledge-embedding] selected document commit finished', {
      runCount: committed.length,
    });
    return committed;
  }

  async addDocument(command: AddKnowledgeEmbeddingDocumentCommand): Promise<KnowledgeEmbeddingDocumentMutationResult> {
    if (!command.documentId.trim() || command.documentVersion < 1) {
      throw new Error('Document identity and version are required');
    }

    const existing = await this.workflowRepository.findByDocumentVersion(command.documentId, command.documentVersion);
    if (existing) {
      console.info('[knowledge-embedding] existing workflow found; skipping duplicate document commit', {
        documentId: command.documentId,
        documentVersion: command.documentVersion,
        runId: existing.id,
        status: existing.status,
      });
      const document = await this.documentRepository.findById(command.documentId);
      if (!document) throw new Error('Persisted workflow is missing its document');
      return { run: this.toView(existing, document), alreadyHandled: true };
    }

    const storageFilename = command.metadata.name.replace(/[\\/]/g, '_');
    const uniqueStorageFilename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${storageFilename}`;
    const storedPath = command.metadata.uri
      ? await this.fileSystem.copyToAppStorage(command.metadata.uri, uniqueStorageFilename)
      : undefined;
    console.info('[knowledge-embedding] document copied to app storage', {
      documentId: command.documentId,
      documentVersion: command.documentVersion,
      storedPath,
    });
    let contentHash = command.metadata.contentHash;
    try {
      if (!contentHash && storedPath && this.fileSystem.computeSha256) {
        contentHash = await this.fileSystem.computeSha256(storedPath);
      }
    } catch (error) {
      if (storedPath) await this.fileSystem.deleteFile(storedPath).catch(() => undefined);
      throw error;
    }
    const matchingDocuments = contentHash
      ? (await this.documentRepository.findAll({ checksum: contentHash, projectId: command.projectId }))
        .filter((candidate) => candidate.id !== command.documentId && !candidate.ragSourceDocumentId)
      : [];
    const matchingRuns = await Promise.all(matchingDocuments.map(async (candidate) => ({
      document: candidate,
      run: await this.workflowRepository.findByDocumentVersion(candidate.id, command.documentVersion),
    })));
    const completedMatch = matchingRuns
      .filter(({ run }) => run?.status === 'completed')
      .sort((left, right) => {
        const updatedAtDifference = (right.run?.updatedAt ?? 0) - (left.run?.updatedAt ?? 0);
        return updatedAtDifference || left.document.id.localeCompare(right.document.id);
      })[0];
    const queuedMatch = matchingRuns.find(({ run }) => run?.status === 'pending' || run?.status === 'running');

    if (!completedMatch && queuedMatch?.run) {
      if (storedPath) await this.fileSystem.deleteFile(storedPath).catch(() => undefined);
      return {
        run: this.toView(queuedMatch.run, queuedMatch.document, queuedMatch.document.id),
        alreadyHandled: true,
      };
    }

    const matchingDocument = completedMatch?.document;
    const matchingRun = completedMatch?.run ?? null;

    const document: Document = {
      id: command.documentId,
      ragSourceDocumentId: matchingRun ? matchingDocument?.id : undefined,
      projectId: command.projectId,
      filename: command.metadata.name,
      title: command.metadata.name,
      type: command.metadata.type,
      size: Number.parseInt(command.metadata.size, 10) || undefined,
      uri: command.metadata.uri,
      localPath: storedPath,
      status: 'local-only',
      checksum: contentHash,
    };

    if (matchingRun && matchingDocument) {
      await this.documentRepository.save(document);
      return {
        run: this.toView(matchingRun, document, command.documentId),
        alreadyHandled: true,
      };
    }
    const now = Date.now();
    const record: DocumentChunkingWorkflowRecord = {
      id: `run-${command.documentId}-${command.documentVersion}`,
      documentId: command.documentId,
      documentVersion: command.documentVersion,
      projectId: command.projectId,
      status: 'pending',
      workflowState: 'pending',
      lastEvent: 'document-added',
      retryCount: 0,
      circuitOpen: false,
      resumeFromCheckpoint: false,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await this.documentRepository.save(document);
      console.info('[knowledge-embedding] document saved', {
        documentId: document.id,
        documentVersion: command.documentVersion,
        localPath: document.localPath,
        checksum: document.checksum,
      });
      await this.workflowRepository.upsert(record);
      console.info('[knowledge-embedding] workflow saved', {
        documentId: record.documentId,
        runId: record.id,
        status: record.status,
        stage: record.workflowState,
      });
    } catch (error) {
      console.info('[knowledge-embedding] document/workflow persistence failed', {
        documentId: command.documentId,
        runId: record.id,
        error,
      });
      await this.documentRepository.delete(command.documentId).catch(() => undefined);
      if (storedPath) await this.fileSystem.deleteFile(storedPath).catch(() => undefined);
      throw error;
    }

    this.queue.publish(this.toQueueItem(record));
    console.info('[knowledge-embedding] workflow queued for processing', {
      documentId: record.documentId,
      runId: record.id,
      documentVersion: record.documentVersion,
    });
    return { run: this.toView(record, document), alreadyHandled: false };
  }

  async updateStatus(
    runId: string,
    status: KnowledgeEmbeddingRunStatus,
    stage?: KnowledgeEmbeddingRunStage,
    error?: KnowledgeEmbeddingDocumentError,
  ): Promise<KnowledgeEmbeddingRunView> {
    const record = await this.workflowRepository.findByStatus('pending');
    const matching = record.find((item) => item.id === runId) ??
      (await this.workflowRepository.findByStatus('running')).find((item) => item.id === runId) ??
      (await this.workflowRepository.findByStatus('partial')).find((item) => item.id === runId) ??
      (await this.workflowRepository.findByStatus('failed')).find((item) => item.id === runId);
    if (!matching) throw new Error('Knowledge embedding run not found');

    const updated: DocumentChunkingWorkflowRecord = {
      ...matching,
      status,
      workflowState: stage ?? matching.workflowState,
      validationReason: error?.message,
      lastEvent: error ? `error:${error.code}` : `status:${status}`,
      retryCount: status === 'running' && matching.status === 'failed' ? matching.retryCount + 1 : matching.retryCount,
      resumeFromCheckpoint: status === 'running' ? true : matching.resumeFromCheckpoint,
      updatedAt: Date.now(),
    };
    await this.workflowRepository.upsert(updated);
    if (status === 'pending' || status === 'partial' || status === 'running') {
      this.queue.publish(this.toQueueItem(updated));
    }
    const document = await this.documentRepository.findById(updated.documentId);
    if (!document) throw new Error('Persisted workflow is missing its document');
    return this.toView(updated, document);
  }

  async retryDocument(documentId: string, documentVersion: number): Promise<KnowledgeEmbeddingRunView> {
    const record = await this.workflowRepository.findByDocumentVersion(documentId, documentVersion);
    if (!record) throw new Error('Knowledge embedding run not found');
    if (record.status === 'completed' || record.status === 'cancelled') {
      throw new Error('Knowledge embedding run cannot be retried');
    }
    if (!record.workflowState) throw new Error('Knowledge embedding run stage is required before retry');

    return this.updateStatus(record.id, 'running', record.workflowState as KnowledgeEmbeddingRunStage);
  }

  async restoreAndResume(): Promise<KnowledgeEmbeddingRunView[]> {
    const documents = await this.listDocuments();
    const recovered: KnowledgeEmbeddingRunView[] = [];
    for (const document of documents) {
      if (document.status === 'completed' || document.status === 'cancelled') continue;
      if (document.status === 'running') {
        const resumed = await this.updateStatus(document.id, 'running', document.currentStage);
        recovered.push(resumed);
      } else {
        this.queue.publish(this.toQueueItemFromView(document));
        recovered.push(document);
      }
    }
    return recovered;
  }

  async removeDocument(documentId: string, documentVersion: number): Promise<void> {
    const record = await this.workflowRepository.findByDocumentVersion(documentId, documentVersion);
    const document = await this.documentRepository.findById(documentId);
    if (!record && !document) return;

    const localPath = document?.localPath;
    try {
      if (record && this.workflowRepository.deleteByDocumentVersion) {
        await this.workflowRepository.deleteByDocumentVersion(documentId, documentVersion);
      }
      await this.documentRepository.delete(documentId);
      if (localPath) await this.fileSystem.deleteFile(localPath);
    } catch (error) {
      if (document) await this.documentRepository.save(document).catch(() => undefined);
      if (record) await this.workflowRepository.upsert(record).catch(() => undefined);
      throw error;
    }
  }

  private toView(record: DocumentChunkingWorkflowRecord, document: Document, documentId = record.documentId): KnowledgeEmbeddingRunView {
    return {
      id: record.id,
      documentId,
      documentVersion: record.documentVersion,
      status: record.status as KnowledgeEmbeddingRunStatus,
      currentStage: record.workflowState as KnowledgeEmbeddingRunStage,
      errorMessage: record.validationReason,
      retryCount: record.retryCount,
      checkpointId: record.checkpointId,
      resumeFromCheckpoint: Boolean(record.resumeFromCheckpoint),
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
      metadata: {
        name: document.filename ?? document.title ?? document.id,
        type: document.type ?? 'other',
        size: document.size === undefined ? '' : String(document.size),
        uri: document.uri,
        storageKey: document.storageKey,
        localPath: document.localPath,
        contentHash: document.checksum,
      },
    };
  }

  private toQueueItem(record: DocumentChunkingWorkflowRecord): KnowledgeEmbeddingQueueItem {
    return {
      runId: record.id,
      documentId: record.documentId,
      documentVersion: record.documentVersion,
    };
  }

  private toQueueItemFromView(view: KnowledgeEmbeddingRunView): KnowledgeEmbeddingQueueItem {
    return {
      runId: view.id,
      documentId: view.documentId,
      documentVersion: view.documentVersion,
    };
  }
}
