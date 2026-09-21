import { InMemoryWorkflowQueue, type WorkflowQueueItem } from '../application/services/InMemoryWorkflowQueue';

describe('workflow queue', () => {
  it('publishes each workflow identity once until it is dequeued', () => {
    const queue = new InMemoryWorkflowQueue();
    const item: WorkflowQueueItem = {
      runId: 'run-1',
      documentId: 'document-1',
      documentVersion: 1,
    };

    queue.publish(item);
    queue.publish(item);

    expect(queue.dequeue()).toEqual(item);
    expect(queue.dequeue()).toBeUndefined();
  });

  it('hydrates pending workflow identities without duplicating queued work', () => {
    const queue = new InMemoryWorkflowQueue();
    const items: WorkflowQueueItem[] = [
      { runId: 'run-1', documentId: 'document-1', documentVersion: 1 },
      { runId: 'run-2', documentId: 'document-2', documentVersion: 1 },
    ];

    queue.hydrate([...items, items[0]]);

    expect(queue.dequeue()).toEqual(items[0]);
    expect(queue.dequeue()).toEqual(items[1]);
    expect(queue.dequeue()).toBeUndefined();
  });
});