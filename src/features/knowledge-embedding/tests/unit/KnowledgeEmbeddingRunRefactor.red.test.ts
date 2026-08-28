import { KnowledgeEmbeddingRunEntity, type KnowledgeEmbeddingRun } from '../../domain/entities/KnowledgeEmbeddingRun';
import { KnowledgeDetailRunEntity, type KnowledgeDetailRun } from '../../domain/entities/KnowledgeDetailRun';

describe('KnowledgeEmbeddingRunRefactor', () => {
  it('creates and starts a valid parent run for a document workflow', () => {
    const run = KnowledgeEmbeddingRunEntity.create({
      id: 'run-1',
      documentId: 'doc-1',
      status: 'pending',
      currentStage: 'parsing',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const started = run.start('chunking');

    expect(started.documentId).toBe('doc-1');
    expect(started.status).toBe('running');
    expect(started.currentStage).toBe('chunking');
  });

  it('rejects a parent run without a document id', () => {
    expect(() =>
      KnowledgeEmbeddingRunEntity.create({
        id: 'run-2',
        documentId: '',
        status: 'pending',
        createdAt: new Date(),
      } as KnowledgeEmbeddingRun),
    ).toThrow('KnowledgeEmbeddingRun documentId is required');
  });

  it('creates and starts a valid child stage run bound to the parent run', () => {
    const detail = KnowledgeDetailRunEntity.create({
      id: 'detail-1',
      runId: 'run-1',
      stage: 'chunking',
      status: 'pending',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const started = detail.start();

    expect(started.runId).toBe('run-1');
    expect(started.stage).toBe('chunking');
    expect(started.status).toBe('running');
  });

  it('rejects a child run without a parent run id', () => {
    expect(() =>
      KnowledgeDetailRunEntity.create({
        id: 'detail-2',
        runId: '',
        stage: 'embedding',
        status: 'pending',
        createdAt: new Date(),
      } as KnowledgeDetailRun),
    ).toThrow('KnowledgeDetailRun runId is required');
  });

  it('requires the failed stage to be retryable without losing earlier completed work', () => {
    const parent = KnowledgeEmbeddingRunEntity.create({
      id: 'run-3',
      documentId: 'doc-3',
      status: 'running',
      currentStage: 'embedding',
      createdAt: new Date(),
    });

    const child = KnowledgeDetailRunEntity.create({
      id: 'detail-3',
      runId: parent.data().id,
      stage: 'embedding',
      status: 'failed',
      errorMessage: 'embedding dependency unavailable',
      retryCount: 1,
      createdAt: new Date(),
    });

    const retried = child.retry();

    expect(parent.data().status).toBe('running');
    expect(child.data().status).toBe('failed');
    expect(retried.status).toBe('running');
    expect(retried.retryCount).toBe(2);
  });

  it('marks a complete workflow only after all required stages have succeeded', () => {
    const parent = KnowledgeEmbeddingRunEntity.create({
      id: 'run-4',
      documentId: 'doc-4',
      status: 'running',
      currentStage: 'indexing',
      createdAt: new Date(),
    });

    const completed = parent.complete();

    expect(completed.currentStage).toBe('indexing');
    expect(completed.status).toBe('completed');
  });

  it('resumes a partial workflow from its current stage without resetting progress state', () => {
    const parent = KnowledgeEmbeddingRunEntity.create({
      id: 'run-5',
      documentId: 'doc-5',
      status: 'partial',
      currentStage: 'chunking',
      errorMessage: 'interrupted',
      createdAt: new Date(),
    });

    const resumed = parent.restartOrResume();

    expect(resumed.status).toBe('running');
    expect(resumed.currentStage).toBe('chunking');
    expect(resumed.errorMessage).toBeUndefined();
  });

  it('retries the current failed stage only when the parent is eligible for recovery', () => {
    const parent = KnowledgeEmbeddingRunEntity.create({
      id: 'run-6',
      documentId: 'doc-6',
      status: 'failed',
      currentStage: 'embedding',
      errorMessage: 'embedding dependency unavailable',
      createdAt: new Date(),
    });

    const retried = parent.retryActiveStage();

    expect(retried.status).toBe('running');
    expect(retried.currentStage).toBe('embedding');
    expect(retried.errorMessage).toBeUndefined();
  });

  it('rejects retry attempts for completed or cancelled runs', () => {
    const completedRun = KnowledgeEmbeddingRunEntity.create({
      id: 'run-7',
      documentId: 'doc-7',
      status: 'completed',
      currentStage: 'indexing',
      createdAt: new Date(),
    });

    expect(() => completedRun.retryActiveStage()).toThrow('KnowledgeEmbeddingRun retry is only allowed while active or partial');
  });
});
