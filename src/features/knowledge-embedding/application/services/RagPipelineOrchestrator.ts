import { KnowledgeEmbeddingRunEntity, type KnowledgeEmbeddingRun } from '../../domain/entities/KnowledgeEmbeddingRun';
import type { KnowledgeEmbeddingRunRepository } from '../../domain/repositories/KnowledgeEmbeddingRunRepository';
import { InMemoryWorkflowQueue, type KnowledgeEmbeddingQueueItem } from './InMemoryWorkflowQueue';

export interface RagPipelineOrchestratorDependencies {
  workflowRepository: KnowledgeEmbeddingRunRepository;
  queue?: InMemoryWorkflowQueue;
}

export class RagPipelineOrchestrator {
  private readonly workflowRepository: KnowledgeEmbeddingRunRepository;
  private readonly queue: InMemoryWorkflowQueue;

  constructor(deps: RagPipelineOrchestratorDependencies) {
    this.workflowRepository = deps.workflowRepository;
    this.queue = deps.queue ?? new InMemoryWorkflowQueue();
  }

  async execute(documentId: string): Promise<KnowledgeEmbeddingRun> {
    if (!documentId || !documentId.trim()) {
      throw new Error('Document id is required');
    }

    const existing = await this.workflowRepository.findByDocumentId(documentId);
    if (existing) {
      if (existing.status !== 'failed' && existing.status !== 'completed') {
        this.queue.publish(this.toQueueItem(existing));
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
    this.queue.publish(this.toQueueItem(persisted));
    return persisted;
  }

  async resume(documentId: string): Promise<KnowledgeEmbeddingRun> {
    if (!documentId || !documentId.trim()) {
      throw new Error('Document id is required');
    }

    const existing = await this.workflowRepository.findByDocumentId(documentId);
    if (existing) {
      if (existing.status === 'pending' || existing.status === 'partial' || existing.status === 'running') {
        this.queue.publish(this.toQueueItem(existing));
      }
      return existing;
    }

    return this.execute(documentId);
  }

  async restoreQueue(): Promise<KnowledgeEmbeddingRun[]> {
    const pending = await this.workflowRepository.findByStatus('pending');
    const partial = await this.workflowRepository.findByStatus('partial');
    const running = await this.workflowRepository.findByStatus('running');
    const hydrated = [...pending, ...partial, ...running];
    this.queue.hydrate(hydrated.map((run) => this.toQueueItem(run)));
    return hydrated;
  }

  publish(run: KnowledgeEmbeddingRun): void {
    this.queue.publish(this.toQueueItem(run));
  }

  private toQueueItem(run: KnowledgeEmbeddingRun): KnowledgeEmbeddingQueueItem {
    return {
      runId: run.id,
      documentId: run.documentId,
      documentVersion: 1,
    };
  }
}
