jest.mock('../../../../shared/infrastructure/di/registerServices', () => ({}));

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { container } from 'tsyringe';
import { InMemoryWorkflowQueue } from '../../workflow/application/services/InMemoryWorkflowQueue';
import { KnowledgeEmbeddingQueueConsumer } from '../../workflow/application/services/KnowledgeEmbeddingQueueConsumer';
import { KnowledgeEmbeddingStep } from '../../workflow/domain/value-objects/KnowledgeEmbeddingStep';
import { useKnowledgeEmbeddingFlow } from '../../ui/hooks/useKnowledgeEmbeddingFlow';

const initialRun = {
  id: 'run-1',
  documentId: 'doc-1',
  documentVersion: 1,
  status: 'running',
  currentStage: 'parsing',
  retryCount: 0,
  resumeFromCheckpoint: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('useKnowledgeEmbeddingFlow queue lifecycle', () => {
  let queue: InMemoryWorkflowQueue;
  let consumer: KnowledgeEmbeddingQueueConsumer;
  let executeQueuedItem: jest.Mock;
  let getRuns: jest.Mock;

  beforeEach(() => {
    container.reset();
    queue = new InMemoryWorkflowQueue();
    executeQueuedItem = jest.fn().mockResolvedValue(undefined);
    consumer = new KnowledgeEmbeddingQueueConsumer(queue, { executeQueuedItem });
    getRuns = jest.fn().mockResolvedValue([initialRun]);

    container.registerInstance('InMemoryWorkflowQueue', queue);
    container.registerInstance('KnowledgeEmbeddingQueueConsumer', consumer);
    container.registerInstance('KnowledgeEmbeddingDocumentService', {
      commitDocuments: jest.fn().mockResolvedValue([initialRun]),
      getRuns,
      restoreAndResume: jest.fn().mockResolvedValue([]),
    });
    container.registerInstance('IFilePickerAdapter', {
      pickDocument: jest.fn(),
    });
  });

  afterEach(() => {
    consumer.stop();
    container.reset();
  });

  it('observes processing completion without claiming the queue subscription', async () => {
    consumer.start();
    const { result } = renderHook(() => useKnowledgeEmbeddingFlow());

    act(() => {
      result.current.addDocument({ id: 'doc-1', name: 'plan.pdf', size: '1', type: 'other' });
    });
    await act(async () => {
      await result.current.processDocuments();
    });

    expect(result.current.currentStep).toBe(KnowledgeEmbeddingStep.PROCESSING);

    await act(async () => {
      queue.publish({ runId: 'run-1', documentId: 'doc-1', documentVersion: 1 });
      await consumer.drain();
    });

    await waitFor(() => {
      expect(getRuns).toHaveBeenCalledWith(['doc-1']);
    });
  });

  it('removes only the UI listener when the processing hook unmounts', async () => {
    consumer.start();
    const { result, unmount } = renderHook(() => useKnowledgeEmbeddingFlow());

    act(() => {
      result.current.addDocument({ id: 'doc-1', name: 'plan.pdf', size: '1', type: 'other' });
    });
    await act(async () => {
      await result.current.processDocuments();
    });
    unmount();

    await act(async () => {
      queue.publish({ runId: 'run-1', documentId: 'doc-1', documentVersion: 1 });
      await consumer.drain();
    });

    expect(executeQueuedItem).toHaveBeenCalledWith({
      runId: 'run-1',
      documentId: 'doc-1',
      documentVersion: 1,
    });
  });
});