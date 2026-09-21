import { KnowledgeEmbeddingRunEntity, type KnowledgeEmbeddingRun } from '../../domain/entities/KnowledgeEmbeddingRun';
import type { KnowledgeEmbeddingRunRepository } from '../../domain/repositories/KnowledgeEmbeddingRunRepository';
import { InMemoryWorkflowQueue, type KnowledgeEmbeddingQueueItem } from './InMemoryWorkflowQueue';
import type { Document } from '../../../../../shared/domain/entities/Document';
import type { KnowledgeEmbedding } from '../../../../../shared/domain/entities/KnowledgeEmbedding';
import type { DocumentRepository } from '../../../../../shared/domain/repositories/DocumentRepository';
import type { DocumentChunkingWorkflowRecord, DocumentChunkingWorkflowRepository } from '../../../../../shared/domain/repositories/DocumentChunkingWorkflowRepository';
import type { EmbeddingRepository } from '../../../../../shared/infrastructure/repositories/DrizzleEmbeddingRepository';
import type { ExtractParsedDocumentUseCase } from '../../../document-processing/application/usecases/ExtractParsedDocumentUseCase';
import type { ParseDocumentUseCase } from '../../../document-processing/application/usecases/ParseDocumentUseCase';
import type { ChunkDocumentUseCase } from '../../../document-processing/application/usecases/ChunkDocumentUseCase';
import type { EmbedChunkUseCase } from '../../../embedding/application/contracts/EmbeddingContracts';
import { KnowledgeEmbeddingEntity } from '../../../../../shared/domain/entities/KnowledgeEmbedding';

export interface RagPipelineExecutionDependencies {
  documentRepository: DocumentRepository;
  workflowRepository: DocumentChunkingWorkflowRepository;
  parseDocument: ParseDocumentUseCase;
  extractParsedDocument: ExtractParsedDocumentUseCase;
  chunkDocument: ChunkDocumentUseCase;
  embedChunk: EmbedChunkUseCase;
  embeddingRepository: EmbeddingRepository;
}

export interface RagPipelineOrchestratorDependencies {
  workflowRepository: KnowledgeEmbeddingRunRepository;
  queue?: InMemoryWorkflowQueue;
  pipeline?: RagPipelineExecutionDependencies;
}

export class RagPipelineOrchestrator {
  private readonly workflowRepository: KnowledgeEmbeddingRunRepository;
  private readonly queue: InMemoryWorkflowQueue;
  private readonly pipeline?: RagPipelineExecutionDependencies;

  constructor(deps: RagPipelineOrchestratorDependencies) {
    this.workflowRepository = deps.workflowRepository;
    this.queue = deps.queue ?? new InMemoryWorkflowQueue();
    this.pipeline = deps.pipeline;
  }

  async executeQueuedItem(item: KnowledgeEmbeddingQueueItem): Promise<DocumentChunkingWorkflowRecord> {
    if (!this.pipeline) {
      throw new Error('RAG pipeline execution dependencies are not configured');
    }

    const record = await this.pipeline.workflowRepository.findByDocumentVersion(item.documentId, item.documentVersion);
    if (!record) throw new Error('Knowledge embedding workflow not found');
    if (record.id !== item.runId) throw new Error('Queue item does not match the persisted workflow');
    if (record.status === 'completed' || record.status === 'cancelled') return record;

    const document = await this.pipeline.documentRepository.findById(item.documentId);
    if (!document) throw new Error('Persisted workflow is missing its document');

    await this.persistPipelineState(record, 'running', 'parsing');

    try {
      let extractedDocumentText;
      try {
        extractedDocumentText = (await this.pipeline.extractParsedDocument.execute({
          documentId: item.documentId,
          documentVersion: item.documentVersion,
        })).extractedDocumentText;
      } catch {
        await this.pipeline.parseDocument.execute(this.toParseInput(document, item));
        extractedDocumentText = (await this.pipeline.extractParsedDocument.execute({
          documentId: item.documentId,
          documentVersion: item.documentVersion,
        })).extractedDocumentText;
      }

      await this.persistPipelineState(record, 'running', 'chunking');
      const chunked = await this.pipeline.chunkDocument.execute({
        documentId: item.documentId,
        documentVersionId: record.id,
        documentVersion: item.documentVersion,
        projectId: record.projectId,
        extractedDocumentText,
        validationStatus: 'passed',
        fileName: document.filename ?? document.title,
      });
      if (chunked.status === 'failed') throw new Error('Document chunking failed');

      await this.persistPipelineState(record, 'running', 'embedding');
      await this.embedChunks(
        chunked.chunks.filter((chunk) => !chunk.isSuperseded),
        item.documentId,
        item.documentVersion,
      );
      return await this.persistPipelineState(record, 'completed', 'completed');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.persistPipelineState(record, 'failed', record.workflowState, message);
      throw error;
    }
  }

  async execute(documentId: string): Promise<KnowledgeEmbeddingRun> {
    if (!documentId || !documentId.trim()) {
      throw new Error('Document id is required');
    }

    console.info('[knowledge-embedding] pipeline execution requested', { documentId });
    const existing = await this.workflowRepository.findByDocumentId(documentId);
    if (existing) {
      console.info('[knowledge-embedding] existing pipeline run found', {
        documentId,
        runId: existing.id,
        status: existing.status,
        stage: existing.currentStage,
      });
      if (existing.status !== 'failed' && existing.status !== 'completed') {
        this.queue.publish(this.toQueueItem(existing));
        console.info('[knowledge-embedding] existing pipeline run re-queued', { documentId, runId: existing.id });
      }
      return existing;
    }

    const run = KnowledgeEmbeddingRunEntity.create({
      id: `run-${Date.now().toString(36)}`,
      documentId,
      status: 'pending',
      currentStage: 'parsing',
      createdAt: new Date(),
    }).data();

    const persisted = await this.workflowRepository.create(run);
    console.info('[knowledge-embedding] pipeline run created', {
      documentId,
      runId: persisted.id,
      status: persisted.status,
      stage: persisted.currentStage,
    });
    this.queue.publish(this.toQueueItem(persisted));
    console.info('[knowledge-embedding] pipeline run queued', { documentId, runId: persisted.id });
    return persisted;
  }

  async resume(documentId: string): Promise<KnowledgeEmbeddingRun> {
    if (!documentId || !documentId.trim()) {
      throw new Error('Document id is required');
    }

    console.info('[knowledge-embedding] pipeline resume requested', { documentId });
    const existing = await this.workflowRepository.findByDocumentId(documentId);
    if (existing) {
      if (existing.status === 'pending' || existing.status === 'partial' || existing.status === 'running') {
        this.queue.publish(this.toQueueItem(existing));
        console.info('[knowledge-embedding] pipeline run resumed and queued', {
          documentId,
          runId: existing.id,
          status: existing.status,
          stage: existing.currentStage,
        });
      }
      return existing;
    }

    return this.execute(documentId);
  }

  async restoreQueue(): Promise<KnowledgeEmbeddingRun[]> {
    console.info('[knowledge-embedding] restoring pipeline queue');
    const pending = await this.workflowRepository.findByStatus('pending');
    const partial = await this.workflowRepository.findByStatus('partial');
    const running = await this.workflowRepository.findByStatus('running');
    const hydrated = [...pending, ...partial, ...running];
    this.queue.hydrate(hydrated.map((run) => this.toQueueItem(run)));
    console.info('[knowledge-embedding] pipeline queue restored', {
      pending: pending.length,
      partial: partial.length,
      running: running.length,
      total: hydrated.length,
    });
    return hydrated;
  }

  async restorePipelineQueue(): Promise<DocumentChunkingWorkflowRecord[]> {
    if (!this.pipeline) {
      throw new Error('RAG pipeline execution dependencies are not configured');
    }

    const pending = await this.pipeline.workflowRepository.findByStatus('pending');
    const partial = await this.pipeline.workflowRepository.findByStatus('partial');
    const running = await this.pipeline.workflowRepository.findByStatus('running');
    const hydrated = [...pending, ...partial, ...running];
    this.queue.hydrate(hydrated.map((record) => ({
      runId: record.id,
      documentId: record.documentId,
      documentVersion: record.documentVersion,
    })));
    return hydrated;
  }

  publish(run: KnowledgeEmbeddingRun): void {
    this.queue.publish(this.toQueueItem(run));
  }

  private async embedChunks(
    chunks: Array<{ id: string; content: string }>,
    documentId: string,
    documentVersion: number,
  ): Promise<void> {
    if (!this.pipeline) throw new Error('RAG pipeline execution dependencies are not configured');

    for (const chunk of chunks) {
      const existing = await this.pipeline.embeddingRepository.findByChunkId(chunk.id);
      if (existing.length > 0) continue;

      const result = await this.pipeline.embedChunk.execute({
        documentId,
        documentVersion,
        chunkId: chunk.id,
        text: chunk.content,
      });
      if (!result.vector) throw new Error(`Embedding failed for chunk ${chunk.id}`);

      const embedding: KnowledgeEmbedding = KnowledgeEmbeddingEntity.create({
        id: `${chunk.id}-${result.provider ?? 'default'}-${result.modelVersion ?? 'default'}`,
        chunkId: chunk.id,
        vector: result.vector,
        dimension: result.vector.length,
        provider: result.provider,
        modelVersion: result.modelVersion,
        createdAt: new Date(),
      }).data();
      await this.pipeline.embeddingRepository.save(embedding);
    }
  }

  private async persistPipelineState(
    record: DocumentChunkingWorkflowRecord,
    status: string,
    workflowState: string,
    errorMessage?: string,
  ): Promise<DocumentChunkingWorkflowRecord> {
    if (!this.pipeline) throw new Error('RAG pipeline execution dependencies are not configured');

    const updated: DocumentChunkingWorkflowRecord = {
      ...record,
      status,
      workflowState,
      lastEvent: errorMessage ? 'pipeline_failed' : `pipeline_${workflowState}`,
      validationReason: errorMessage,
      retryCount: errorMessage ? record.retryCount + 1 : record.retryCount,
      resumeFromCheckpoint: status === 'failed',
      updatedAt: Date.now(),
    };
    await this.pipeline.workflowRepository.upsert(updated);
    return updated;
  }

  private toParseInput(document: Document, item: KnowledgeEmbeddingQueueItem) {
    const filename = document.filename ?? document.title ?? '';
    const sourceType = document.mimeType?.toLowerCase().includes('pdf') || filename.toLowerCase().endsWith('.pdf')
      ? 'pdf'
      : 'text';
    return {
      documentId: item.documentId,
      documentVersion: item.documentVersion,
      projectId: document.projectId,
      sourceType: sourceType as 'pdf' | 'image' | 'text' | 'docx',
      contentType: document.mimeType,
      filePath: document.localPath ?? document.uri,
      rawText: document.ocrText,
    };
  }

  private toQueueItem(run: KnowledgeEmbeddingRun): KnowledgeEmbeddingQueueItem {
    return {
      runId: run.id,
      documentId: run.documentId,
      documentVersion: 1,
    };
  }
}