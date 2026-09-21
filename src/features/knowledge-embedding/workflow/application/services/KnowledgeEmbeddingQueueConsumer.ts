import type { WorkflowQueueItem } from './InMemoryWorkflowQueue';
import { InMemoryWorkflowQueue } from './InMemoryWorkflowQueue';

export interface KnowledgeEmbeddingPipelineExecutor {
  executeQueuedItem(item: WorkflowQueueItem): Promise<unknown>;
}

export type KnowledgeEmbeddingConsumerListener = (item: WorkflowQueueItem) => void;

export class KnowledgeEmbeddingQueueConsumer {
  private unsubscribe?: () => void;
  private drainPromise?: Promise<void>;
  private readonly activeRunIds = new Set<string>();
  private readonly listeners = new Set<KnowledgeEmbeddingConsumerListener>();
  private stopped = false;

  constructor(
    private readonly queue: InMemoryWorkflowQueue,
    private readonly executor: KnowledgeEmbeddingPipelineExecutor,
  ) {}

  start(): void {
    if (this.unsubscribe) return;

    this.stopped = false;
    this.unsubscribe = this.queue.subscribe(() => {
      void Promise.resolve().then(() => this.drain());
    });
    void Promise.resolve().then(() => this.drain());
  }

  stop(): void {
    this.stopped = true;
    this.unsubscribe?.();
    this.unsubscribe = undefined;
  }

  drain(): Promise<void> {
    if (this.stopped) return Promise.resolve();
    if (this.drainPromise) return this.drainPromise;

    this.drainPromise = this.drainQueue().finally(() => {
      this.drainPromise = undefined;
    });
    return this.drainPromise;
  }

  addListener(listener: KnowledgeEmbeddingConsumerListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async processNext(): Promise<boolean> {
    if (this.stopped) return false;

    const item = this.queue.dequeue();
    if (!item) return false;

    if (this.activeRunIds.has(item.runId)) {
      console.info('[knowledge-embedding] active queue item ignored', {
        runId: item.runId,
        documentId: item.documentId,
      });
      return true;
    }

    this.activeRunIds.add(item.runId);
    try {
      await this.executor.executeQueuedItem(item);
    } catch (error) {
      console.info('[knowledge-embedding] queue item processing failed', {
        runId: item.runId,
        documentId: item.documentId,
        error,
      });
    } finally {
      this.activeRunIds.delete(item.runId);
      for (const listener of this.listeners) {
        listener(item);
      }
    }

    return true;
  }

  private async drainQueue(): Promise<void> {
    while (!this.stopped && await this.processNext()) {
      // Continue until the runtime queue is empty.
    }
  }
}