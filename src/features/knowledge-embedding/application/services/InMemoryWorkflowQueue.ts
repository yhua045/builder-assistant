export interface KnowledgeEmbeddingQueueItem {
  runId: string;
  documentId: string;
  documentVersion: number;
}

export interface WorkflowQueueListener {
  (item: KnowledgeEmbeddingQueueItem): void;
}

export class InMemoryWorkflowQueue {
  private readonly queue: KnowledgeEmbeddingQueueItem[] = [];
  private readonly listeners = new Set<WorkflowQueueListener>();
  private readonly queuedIds = new Set<string>();

  hydrate(items: KnowledgeEmbeddingQueueItem[]): void {
    console.info('[knowledge-embedding] queue hydration started', { itemCount: items.length });
    this.queue.length = 0;
    this.queuedIds.clear();

    for (const item of items) {
      const key = this.keyFor(item);
      if (this.queuedIds.has(key)) {
        continue;
      }

      this.queuedIds.add(key);
      this.queue.push(item);
    }
    console.info('[knowledge-embedding] queue hydration completed', { queuedCount: this.queue.length });
  }

  enqueue(item: KnowledgeEmbeddingQueueItem): void {
    const key = this.keyFor(item);
    if (this.queuedIds.has(key)) {
      console.info('[knowledge-embedding] duplicate queue item ignored', item);
      return;
    }

    this.queuedIds.add(key);
    this.queue.push(item);
    console.info('[knowledge-embedding] queue item published', item);
    for (const listener of this.listeners) {
      listener(item);
    }
  }

  dequeue(): KnowledgeEmbeddingQueueItem | undefined {
    const next = this.queue.shift();
    if (!next) {
      return undefined;
    }

    const key = this.keyFor(next);
    this.queuedIds.delete(key);
    return next;
  }

  publish(item: KnowledgeEmbeddingQueueItem): void {
    this.enqueue(item);
  }

  subscribe(listener: WorkflowQueueListener): () => void {
    if (this.listeners.size > 0) {
      throw new Error('Workflow queue already has an active subscriber');
    }

    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  clearStaleRunning(runningRunIds: ReadonlySet<string>): void {
    for (let index = this.queue.length - 1; index >= 0; index -= 1) {
      const item = this.queue[index];
      if (runningRunIds.has(item.runId)) {
        this.queue.splice(index, 1);
        this.queuedIds.delete(this.keyFor(item));
      }
    }
  }

  private keyFor(item: KnowledgeEmbeddingQueueItem): string {
    return `${item.documentId}:${item.documentVersion}:${item.runId}`;
  }
}
