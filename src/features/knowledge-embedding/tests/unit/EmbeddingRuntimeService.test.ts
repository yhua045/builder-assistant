import {
  DefaultEmbeddingModelFactory,
  EmbeddingRuntimeService,
  LocalEmbeddingService,
  type AppEmbeddingCapabilityStore,
} from '../../application/services/EmbeddingRuntimeService';

describe('EmbeddingRuntimeService', () => {
  it('creates deterministic local embeddings with stored dimension and model metadata', async () => {
    const service = new EmbeddingRuntimeService(
      {
        provider: 'local-test',
        modelVersion: 'mini-lm-local-v1',
        dimension: 8,
      },
      new DefaultEmbeddingModelFactory(),
    );

    const vector = await service.embed('Concrete budget is $12,000');

    expect(vector).toBeInstanceOf(Float32Array);
    expect(vector.length).toBe(8);
    expect(service.dimension).toBe(8);
    expect(service.modelVersion).toBe('mini-lm-local-v1');
    expect(service.provider).toBe('local-test');
  });

  it('reads native support from the capability store once and reuses the cached decision', async () => {
    let getCount = 0;
    let setCount = 0;
    const store: AppEmbeddingCapabilityStore = {
      async getNativeEmbeddingSupport() {
        getCount += 1;
        return getCount === 1 ? null : true;
      },
      async setNativeEmbeddingSupport() {
        setCount += 1;
        return;
      },
    };

    const service = new EmbeddingRuntimeService(
      {
        provider: 'react-native-executorch',
        modelVersion: 'executorch-v1',
        dimension: 8,
      },
      new DefaultEmbeddingModelFactory(),
      store,
    );

    await service.embed('cached capability should be used');
    await service.embed('cached capability should be used again');

    expect(getCount).toBe(1);
    expect(setCount).toBe(1);
    expect(service.provider).toBe('react-native-executorch');
  });

  it('supports batch embedding and safe retry patterns', async () => {
    const service = new LocalEmbeddingService({
      provider: 'local-model',
      modelVersion: 'bge-small-local-v1',
      dimension: 6,
    });

    const vectors = await service.embedBatch(['schedule is tight', 'budget is approved']);

    expect(vectors).toHaveLength(2);
    vectors.forEach(vector => {
      expect(vector).toBeInstanceOf(Float32Array);
      expect(vector.length).toBe(6);
    });

    await expect(service.embed('')).rejects.toThrow('text is required');
    await expect(service.embed('schedule is tight')).resolves.toBeInstanceOf(Float32Array);
  });

  it('allows the model implementation to be replaced without changing the contract', async () => {
    const replacement = new EmbeddingRuntimeService(
      {
        provider: 'local-replacement',
        modelVersion: 'replacement-v2',
        dimension: 12,
      },
      new DefaultEmbeddingModelFactory(),
    );

    const vector = await replacement.embed('replaced model output');
    expect(vector.length).toBe(12);
    expect(replacement.modelVersion).toBe('replacement-v2');
  });

  it('rejects the executorch provider clearly when the native module is unavailable', async () => {
    const service = new EmbeddingRuntimeService(
      {
        provider: 'react-native-executorch',
        modelVersion: 'executorch-v1',
        dimension: 8,
      },
      new DefaultEmbeddingModelFactory(),
    );

    await expect(service.embed('native path test')).rejects.toThrow(
      /react-native-executorch|native embedding module/i,
    );
  });
});
