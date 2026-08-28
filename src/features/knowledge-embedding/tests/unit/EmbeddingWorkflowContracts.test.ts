import {
  EmbedChunkUseCaseImpl,
  EmbeddingWorkflowState,
  QueryEmbeddingUseCaseImpl,
} from '../../application/contracts/EmbeddingWorkflowContracts';
import {
  DefaultEmbeddingModelFactory,
  EmbeddingProviderEmbeddingService,
} from '../../application/services/EmbeddingProviderEmbeddingService';

describe('Embedding workflow contracts', () => {
  it('exposes the simplified embedding workflow state model', () => {
    const states: EmbeddingWorkflowState[] = [
      'chunk-received',
      'validation-failed',
      'embedding-succeeded',
      'embedding-failed',
    ];

    expect(states).toHaveLength(4);
    expect(states).toContain('chunk-received');
    expect(states).toContain('validation-failed');
    expect(states).toContain('embedding-succeeded');
    expect(states).toContain('embedding-failed');
  });

  it('embeds valid chunk content and reports the success state', async () => {
    const service = new EmbeddingProviderEmbeddingService({
      provider: 'local-test-provider',
      modelVersion: 'local-v1',
      dimension: 8,
    }, new DefaultEmbeddingModelFactory());
    const useCase = new EmbedChunkUseCaseImpl(service);

    const result = await useCase.execute({
      documentId: 'doc-1',
      documentVersion: 1,
      chunkId: 'chunk-1',
      text: 'valid content',
    });

    expect(result.status).toBe('embedded');
    expect(result.chunkId).toBe('chunk-1');
    expect(result.provider).toBe('local-test-provider');
    expect(result.modelVersion).toBe('local-v1');
    expect(result.vector).toHaveLength(8);
  });

  it('rejects invalid chunk content and marks the validation failure state', async () => {
    const service = new EmbeddingProviderEmbeddingService({
      provider: 'local-test-provider',
      modelVersion: 'local-v1',
      dimension: 8,
    }, new DefaultEmbeddingModelFactory());
    const useCase = new EmbedChunkUseCaseImpl(service);

    await expect(
      useCase.execute({
        documentId: 'doc-1',
        documentVersion: 1,
        chunkId: 'chunk-1',
        text: '   ',
      }),
    ).rejects.toThrow('Chunk text is required');
  });

  it('returns a valid query vector using the same provider and dimension contract', async () => {
    const service = new EmbeddingProviderEmbeddingService(
      {
        provider: 'local-query-provider',
        modelVersion: 'local-query-v1',
        dimension: 8,
      },
      new DefaultEmbeddingModelFactory(),
    );
    const useCase = new QueryEmbeddingUseCaseImpl(service);

    const vector = await useCase.execute({
      text: 'query text',
      dimension: 8,
      provider: 'local-query-provider',
      modelVersion: 'local-query-v1',
    });

    expect(vector).toBeInstanceOf(Float32Array);
    expect(vector.length).toBe(8);
  });
});
