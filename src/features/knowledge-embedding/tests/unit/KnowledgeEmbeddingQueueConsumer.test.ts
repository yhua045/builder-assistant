import { InMemoryWorkflowQueue, type KnowledgeEmbeddingQueueItem } from '../../application/services/InMemoryWorkflowQueue';
import {
  KnowledgeEmbeddingQueueConsumer,
  type KnowledgeEmbeddingPipelineExecutor,
} from '../../application/services/KnowledgeEmbeddingQueueConsumer';

function item(runId: string, documentId = runId): KnowledgeEmbeddingQueueItem {
  return { runId, documentId, documentVersion: 1 };
}

describe('KnowledgeEmbeddingQueueConsumer', () => {
  it('processes work published after the consumer starts', async () => {
    const queue = new InMemoryWorkflowQueue();
    const executeQueuedItem = jest.fn().mockResolvedValue(undefined);
    const consumer = new KnowledgeEmbeddingQueueConsumer(queue, { executeQueuedItem });

    consumer.start();
    queue.publish(item('run-1', 'doc-1'));
    await consumer.drain();

    expect(executeQueuedItem).toHaveBeenCalledWith(item('run-1', 'doc-1'));
    expect(executeQueuedItem).toHaveBeenCalledTimes(1);
  });

  it('drains items in FIFO order', async () => {
    const queue = new InMemoryWorkflowQueue();
    const processed: string[] = [];
    const executor: KnowledgeEmbeddingPipelineExecutor = {
      executeQueuedItem: jest.fn(async (queuedItem) => {
        processed.push(queuedItem.runId);
      }),
    };
    const consumer = new KnowledgeEmbeddingQueueConsumer(queue, executor);

    queue.hydrate([item('run-1'), item('run-2'), item('run-3')]);
    await consumer.drain();

    expect(processed).toEqual(['run-1', 'run-2', 'run-3']);
  });

  it('does not process the same run concurrently when duplicate events arrive', async () => {
    const queue = new InMemoryWorkflowQueue();
    let releaseFirst: (() => void) | undefined;
    const firstExecution = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const executeQueuedItem = jest.fn(async () => firstExecution);
    const consumer = new KnowledgeEmbeddingQueueConsumer(queue, { executeQueuedItem });

    consumer.start();
    queue.publish(item('run-1'));
    queue.publish(item('run-1'));
    await Promise.resolve();

    expect(executeQueuedItem).toHaveBeenCalledTimes(1);
    releaseFirst?.();
    await consumer.drain();
  });

  it('rejects a second consumer for the same queue', () => {
    const queue = new InMemoryWorkflowQueue();
    const firstConsumer = new KnowledgeEmbeddingQueueConsumer(queue, {
      executeQueuedItem: jest.fn().mockResolvedValue(undefined),
    });
    const secondConsumer = new KnowledgeEmbeddingQueueConsumer(queue, {
      executeQueuedItem: jest.fn().mockResolvedValue(undefined),
    });

    firstConsumer.start();

    expect(() => secondConsumer.start()).toThrow('already has an active subscriber');

    firstConsumer.stop();
  });

  it('never executes more than one queued task at a time', async () => {
    const queue = new InMemoryWorkflowQueue();
    let activeExecutions = 0;
    let maximumActiveExecutions = 0;
    const executeQueuedItem = jest.fn(async () => {
      activeExecutions += 1;
      maximumActiveExecutions = Math.max(maximumActiveExecutions, activeExecutions);
      await Promise.resolve();
      activeExecutions -= 1;
    });
    const consumer = new KnowledgeEmbeddingQueueConsumer(queue, { executeQueuedItem });

    queue.hydrate([item('run-1'), item('run-2')]);
    await consumer.drain();

    expect(maximumActiveExecutions).toBe(1);
    expect(executeQueuedItem).toHaveBeenCalledTimes(2);
  });

  it('continues draining after one item fails', async () => {
    const queue = new InMemoryWorkflowQueue();
    const executeQueuedItem = jest.fn()
      .mockRejectedValueOnce(new Error('parse failed'))
      .mockResolvedValueOnce(undefined);
    const consumer = new KnowledgeEmbeddingQueueConsumer(queue, { executeQueuedItem });

    queue.hydrate([item('run-1'), item('run-2')]);
    await expect(consumer.drain()).resolves.toBeUndefined();

    expect(executeQueuedItem).toHaveBeenCalledTimes(2);
    expect(executeQueuedItem.mock.calls[1][0]).toEqual(item('run-2'));
  });

  it('stops accepting newly published work after stop', async () => {
    const queue = new InMemoryWorkflowQueue();
    const executeQueuedItem = jest.fn().mockResolvedValue(undefined);
    const consumer = new KnowledgeEmbeddingQueueConsumer(queue, { executeQueuedItem });

    consumer.start();
    consumer.stop();
    queue.publish(item('run-1'));
    await consumer.drain();

    expect(executeQueuedItem).not.toHaveBeenCalled();
  });
});
