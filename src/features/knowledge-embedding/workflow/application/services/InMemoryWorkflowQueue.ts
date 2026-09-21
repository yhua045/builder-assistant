export interface WorkflowQueueItem {
  runId: string;
  documentId: string;
  documentVersion: number;
}

export type KnowledgeEmbeddingQueueItem = WorkflowQueueItem;

export interface WorkflowQueueListener {
  (item: WorkflowQueueItem): void;
}

export class InMemoryWorkflowQueue {
  private readonly queue: WorkflowQueueItem[] = [];
  private readonly listeners = new Set<WorkflowQueueListener>();
  private readonly queuedIds = new Set<string>();

  hydrate(items: WorkflowQueueItem[]): void {
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

  enqueue(item: WorkflowQueueItem): void {
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

  dequeue(): WorkflowQueueItem | undefined {
    const next = this.queue.shift();
    if (!next) {
      return undefined;
    }

    const key = this.keyFor(next);
    this.queuedIds.delete(key);
    return next;
  }

  publish(item: WorkflowQueueItem): void {
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

  private keyFor(item: WorkflowQueueItem): string {
    return `${item.documentId}:${item.documentVersion}:${item.runId}`;
  }
}