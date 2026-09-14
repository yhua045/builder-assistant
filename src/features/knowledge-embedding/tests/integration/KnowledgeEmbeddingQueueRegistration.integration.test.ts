import { container } from 'tsyringe';
import '../../../../shared/infrastructure/di/registerServices';
import { InMemoryWorkflowQueue } from '../../application/services/InMemoryWorkflowQueue';
import { KnowledgeEmbeddingQueueConsumer } from '../../application/services/KnowledgeEmbeddingQueueConsumer';

describe('knowledge embedding queue registration', () => {
  it('resolves one shared queue and one shared consumer', () => {
    const firstQueue = container.resolve<InMemoryWorkflowQueue>('InMemoryWorkflowQueue');
    const secondQueue = container.resolve<InMemoryWorkflowQueue>('InMemoryWorkflowQueue');
    const firstConsumer = container.resolve<KnowledgeEmbeddingQueueConsumer>('KnowledgeEmbeddingQueueConsumer');
    const secondConsumer = container.resolve<KnowledgeEmbeddingQueueConsumer>('KnowledgeEmbeddingQueueConsumer');

    expect(secondQueue).toBe(firstQueue);
    expect(secondConsumer).toBe(firstConsumer);
  });
});
