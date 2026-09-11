import { KnowledgeEmbeddingRunEntity } from '../../domain/entities/KnowledgeEmbeddingRun';
import { InMemoryWorkflowQueue, type KnowledgeEmbeddingQueueItem } from '../../application/services/InMemoryWorkflowQueue';
import { RagPipelineOrchestrator } from '../../application/services/RagPipelineOrchestrator';
import type { KnowledgeEmbeddingRunRepository } from '../../domain/repositories/KnowledgeEmbeddingRunRepository';

describe('InMemoryWorkflowQueue', () => {
  it('hydrates pending, partial, and interrupted running rows', async () => {
    const queue = new InMemoryWorkflowQueue();
    const runs = [
      KnowledgeEmbeddingRunEntity.create({ id: 'run-1', documentId: 'doc-1', status: 'pending', currentStage: 'parsing', createdAt: new Date() }).data(),
      KnowledgeEmbeddingRunEntity.create({ id: 'run-2', documentId: 'doc-2', status: 'partial', currentStage: 'chunking', errorMessage: 'retry-safe checkpoint', createdAt: new Date() }).data(),
      KnowledgeEmbeddingRunEntity.create({ id: 'run-3', documentId: 'doc-3', status: 'running', currentStage: 'embedding', createdAt: new Date() }).data(),
    ];

    queue.hydrate(runs.map((run): KnowledgeEmbeddingQueueItem => ({
      runId: run.id,
      documentId: run.documentId,
      documentVersion: 1,
    })));

    const queued = queue.dequeue();
    expect(queued?.documentId).toBe('doc-1');
    expect(queue.dequeue()?.documentId).toBe('doc-2');
    expect(queue.dequeue()?.documentId).toBe('doc-3');
    expect(queue.dequeue()).toBeUndefined();
  });

  it('hydrates an interrupted running row for foreground recovery', () => {
    const queue = new InMemoryWorkflowQueue();
    const interruptedRun = KnowledgeEmbeddingRunEntity.create({
      id: 'run-interrupted',
      documentId: 'doc-interrupted',
      status: 'running',
      currentStage: 'embedding',
      createdAt: new Date(),
    }).data();

    queue.hydrate([{ runId: interruptedRun.id, documentId: interruptedRun.documentId, documentVersion: 1 }]);

    expect(queue.dequeue()?.documentId).toBe('doc-interrupted');
  });

  it('deduplicates repeated publish calls for the same run id', () => {
    const queue = new InMemoryWorkflowQueue();
    const listener = jest.fn();
    const unsubscribe = queue.subscribe(listener);

    const run = KnowledgeEmbeddingRunEntity.create({
      id: 'run-9',
      documentId: 'doc-9',
      status: 'pending',
      currentStage: 'parsing',
      createdAt: new Date(),
    }).data();

    const item = { runId: run.id, documentId: run.documentId, documentVersion: 1 };
    queue.publish(item);
    queue.publish(item);

    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});

describe('RagPipelineOrchestrator', () => {
  it('reuses an active workflow for the same document instead of creating duplicates', async () => {
    const workflowRepository: KnowledgeEmbeddingRunRepository = {
      create: jest.fn(),
      findByDocumentId: jest.fn().mockResolvedValue(
        KnowledgeEmbeddingRunEntity.create({
          id: 'run-existing',
          documentId: 'doc-1',
          status: 'running',
          currentStage: 'parsing',
          createdAt: new Date(),
        }).data(),
      ),
      findById: jest.fn(),
      findByStatus: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
    };

    const orchestrator = new RagPipelineOrchestrator({
      workflowRepository,
      queue: new InMemoryWorkflowQueue(),
    });

    const result = await orchestrator.execute('doc-1');

    expect(result.documentId).toBe('doc-1');
    expect(result.status).toBe('running');
    expect(workflowRepository.create).not.toHaveBeenCalled();
  });

  it('resumes a recoverable partial workflow from the last durable stage', async () => {
    const workflowRepository: KnowledgeEmbeddingRunRepository = {
      create: jest.fn(),
      findByDocumentId: jest.fn().mockResolvedValue(
        KnowledgeEmbeddingRunEntity.create({
          id: 'run-partial',
          documentId: 'doc-2',
          status: 'partial',
          currentStage: 'chunking',
          errorMessage: 'resume-safe checkpoint',
          createdAt: new Date(),
        }).data(),
      ),
      findById: jest.fn(),
      findByStatus: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
    };

    const orchestrator = new RagPipelineOrchestrator({
      workflowRepository,
      queue: new InMemoryWorkflowQueue(),
    });

    const result = await orchestrator.resume('doc-2');

    expect(result.status).toBe('partial');
    expect(result.currentStage).toBe('chunking');
  });

  it('restores interrupted running workflows after the app returns to the foreground', async () => {
    const runningRun = KnowledgeEmbeddingRunEntity.create({
      id: 'run-running',
      documentId: 'doc-running',
      status: 'running',
      currentStage: 'embedding',
      createdAt: new Date(),
    }).data();
    const workflowRepository: KnowledgeEmbeddingRunRepository = {
      create: jest.fn(),
      findByDocumentId: jest.fn(),
      findById: jest.fn(),
      findByStatus: jest.fn((status) => Promise.resolve(status === 'running' ? [runningRun] : [])),
      update: jest.fn(),
    };
    const queue = new InMemoryWorkflowQueue();
    const orchestrator = new RagPipelineOrchestrator({ workflowRepository, queue });

    const restored = await orchestrator.restoreQueue();

    expect(restored).toEqual([runningRun]);
    expect(queue.dequeue()?.documentId).toBe('doc-running');
  });
});
