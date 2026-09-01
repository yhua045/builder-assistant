export interface EmbeddingProviderConfig {
  provider: string;
  modelVersion?: string;
  dimension: number;
}

export interface EmbeddingModel {
  embed(text: string): Promise<Float32Array>;
  embedBatch(texts: string[]): Promise<Float32Array[]>;
}

export interface EmbeddingService {
  readonly provider: string;
  readonly modelVersion?: string;
  readonly dimension: number;
  embed(text: string): Promise<Float32Array>;
  embedBatch(texts: string[]): Promise<Float32Array[]>;
  embedWithRetry(text: string, retries?: number): Promise<Float32Array>;
}

export interface EmbeddingModelFactory {
  create(config: EmbeddingProviderConfig): EmbeddingModel;
}

export interface AppEmbeddingCapabilityStore {
  getNativeEmbeddingSupport(): Promise<boolean | null>;
  setNativeEmbeddingSupport(value: boolean): Promise<void>;
}

function isNativeEmbeddingProvider(provider: string): boolean {
  const normalized = provider.trim().toLowerCase();
  return normalized === 'react-native-executorch' || normalized.includes('executorch');
}

function hasNativeEmbeddingSupport(providerName: string): boolean {
  const nativeModules = getReactNativeNativeModules();
  const candidates = [
    providerName,
    'ReactNativeExecuTorch',
    'ExecuTorch',
    'ExecuTorchModule',
    'NativeExecuTorch',
    'Executorch',
  ];

  for (const candidate of candidates) {
    if (nativeModules[candidate]) {
      return true;
    }
  }

  const typedMatch = Object.keys(nativeModules).find((key) =>
    /executorch|execu.*torch|embedding/i.test(key),
  );

  return Boolean(typedMatch && nativeModules[typedMatch]);
}

function getReactNativeNativeModules(): Record<string, unknown> {
  try {
    const reactNative = require('react-native') as { NativeModules?: Record<string, unknown> };
    return reactNative.NativeModules ?? {};
  } catch {
    return {};
  }
}

class DeterministicLocalEmbeddingModel implements EmbeddingModel {
  constructor(private readonly dimension: number) {}

  private hashString(value: string): number {
    let hash = 2166136261;

    for (let index = 0; index < value.length; index += 1) {
      const code = value.charCodeAt(index);
      hash ^= code;
      hash = Math.imul(hash, 16777619);
    }

    return hash >>> 0;
  }

  private toVector(text: string): Float32Array {
    const normalized = text.trim();
    const vector = new Float32Array(this.dimension);
    const seed = this.hashString(normalized);

    for (let index = 0; index < this.dimension; index += 1) {
      const scope = (index + 1) * (seed + 1);
      const angle = scope * 0.6180339887498949 + normalized.length;
      const sample = Math.sin(angle) * 0.5 + 0.5;
      vector[index] = Number.isFinite(sample) ? sample * 2 - 1 : 0;
    }

    return vector;
  }

  async embed(text: string): Promise<Float32Array> {
    if (!text || text.trim().length === 0) {
      throw new Error('text is required');
    }
    return this.toVector(text);
  }

  async embedBatch(texts: string[]): Promise<Float32Array[]> {
    if (!Array.isArray(texts)) {
      throw new Error('texts are required');
    }

    return Promise.all(texts.map((text) => this.embed(text)));
  }
}

class NativeExecuTorchEmbeddingModel implements EmbeddingModel {
  constructor(
    private readonly dimension: number,
    private readonly providerName: string,
  ) {}

  private resolveModule(): Record<string, any> {
    const nativeModules = getReactNativeNativeModules();
    const candidates = [
      this.providerName,
      'ReactNativeExecuTorch',
      'ExecuTorch',
      'ExecuTorchModule',
      'NativeExecuTorch',
      'Executorch',
    ];

    for (const candidate of candidates) {
      const module = nativeModules[candidate];
      if (module) {
        return module;
      }
    }

    const typedMatch = Object.keys(nativeModules).find((key) =>
      /executorch|execu.*torch|embedding/i.test(key),
    );

    if (typedMatch && nativeModules[typedMatch]) {
      return nativeModules[typedMatch] as Record<string, any>;
    }

    throw new Error(
      'react-native-executorch native embedding module is not available in this environment. Install the native dependency or use the local fallback provider.',
    );
  }

  private normalizeVector(raw: unknown, text: string): Float32Array {
    const asArray = Array.isArray(raw)
      ? raw
      : typeof raw === 'string'
        ? raw.split(',').map((item) => Number(item.trim())).filter((item) => Number.isFinite(item))
        : raw && typeof raw === 'object' && 'vector' in raw && Array.isArray((raw as { vector?: unknown[] }).vector)
          ? (raw as { vector: unknown[] }).vector
          : null;

    if (!Array.isArray(asArray)) {
      throw new Error(`react-native-executorch returned an invalid embedding for text: ${text}`);
    }

    const vector = Float32Array.from(asArray.map((value) => Number(value)));

    if (vector.length !== this.dimension) {
      throw new Error(
        `react-native-executorch embedding dimension mismatch: expected ${this.dimension}, received ${vector.length}`,
      );
    }

    if (!vector.every((value) => Number.isFinite(value))) {
      throw new Error(`react-native-executorch embedding contains non-finite values for text: ${text}`);
    }

    return vector;
  }

  async embed(text: string): Promise<Float32Array> {
    if (!text || text.trim().length === 0) {
      throw new Error('text is required');
    }

    const module = this.resolveModule();
    const embedFn =
      typeof module.embed === 'function'
        ? module.embed.bind(module)
        : typeof module.embedText === 'function'
          ? module.embedText.bind(module)
          : typeof module.generateEmbedding === 'function'
            ? module.generateEmbedding.bind(module)
            : null;

    if (!embedFn) {
      throw new Error(
        'react-native-executorch module is present but does not expose an embedding function.',
      );
    }

    const raw = await embedFn(text);
    return this.normalizeVector(raw, text);
  }

  async embedBatch(texts: string[]): Promise<Float32Array[]> {
    if (!Array.isArray(texts)) {
      throw new Error('texts are required');
    }

    const module = this.resolveModule();
    const embedBatchFn =
      typeof module.embedBatch === 'function'
        ? module.embedBatch.bind(module)
        : typeof module.embedTexts === 'function'
          ? module.embedTexts.bind(module)
          : null;

    if (!embedBatchFn) {
      return Promise.all(texts.map((text) => this.embed(text)));
    }

    const rawBatch = await embedBatchFn(texts);
    if (!Array.isArray(rawBatch)) {
      throw new Error('react-native-executorch batch embedding returned an invalid payload');
    }

    return rawBatch.map((item, index) => this.normalizeVector(item, texts[index] ?? ''));
  }
}

export class DefaultEmbeddingModelFactory implements EmbeddingModelFactory {
  create(config: EmbeddingProviderConfig): EmbeddingModel {
    const provider = config.provider.trim().toLowerCase();

    if (provider === 'react-native-executorch' || provider.includes('executorch')) {
      return new NativeExecuTorchEmbeddingModel(config.dimension, config.provider.trim());
    }

    return new DeterministicLocalEmbeddingModel(config.dimension);
  }
}

export class EmbeddingRuntimeService implements EmbeddingService {
  readonly provider: string;
  readonly modelVersion?: string;
  readonly dimension: number;

  private readonly modelFactory: EmbeddingModelFactory;
  private readonly config: EmbeddingProviderConfig;
  private readonly capabilityStore?: AppEmbeddingCapabilityStore;
  private readonly nativeModel: EmbeddingModel;
  private readonly localModel: EmbeddingModel;
  private nativeSupportDecision?: boolean;

  constructor(
    config: EmbeddingProviderConfig,
    modelFactory: EmbeddingModelFactory,
    capabilityStore?: AppEmbeddingCapabilityStore,
  ) {
    if (!config || typeof config !== 'object') {
      throw new Error('EmbeddingProviderConfig is required');
    }
    if (!config.provider || !config.provider.trim()) {
      throw new Error('provider is required');
    }
    if (!Number.isInteger(config.dimension) || config.dimension <= 0) {
      throw new Error('dimension must be a positive integer');
    }

    this.provider = config.provider.trim();
    this.modelVersion = config.modelVersion?.trim() || undefined;
    this.dimension = config.dimension;
    this.modelFactory = modelFactory;
    this.config = config;
    this.capabilityStore = capabilityStore;
    this.localModel = new DeterministicLocalEmbeddingModel(this.dimension);
    this.nativeModel = this.modelFactory.create(config);
  }

  private shouldCheckNativeSupport(): boolean {
    return isNativeEmbeddingProvider(this.provider) && Boolean(this.capabilityStore);
  }

  private async resolveModel(): Promise<EmbeddingModel> {
    if (!this.shouldCheckNativeSupport()) {
      return this.modelFactory.create(this.config);
    }

    if (typeof this.nativeSupportDecision === 'boolean') {
      return this.nativeSupportDecision ? this.nativeModel : this.localModel;
    }

    const storedValue = await this.capabilityStore!.getNativeEmbeddingSupport();

    const detectedSupport =
      storedValue === null || typeof storedValue === 'undefined'
        ? hasNativeEmbeddingSupport(this.provider)
        : storedValue;

    await this.capabilityStore!.setNativeEmbeddingSupport(detectedSupport).catch(() => undefined);

    this.nativeSupportDecision = detectedSupport;
    return detectedSupport ? this.nativeModel : this.localModel;
  }

  async embed(text: string): Promise<Float32Array> {
    const model = this.shouldCheckNativeSupport()
      ? await this.resolveModel()
      : this.modelFactory.create(this.config);
    return model.embed(text);
  }

  async embedBatch(texts: string[]): Promise<Float32Array[]> {
    const model = this.shouldCheckNativeSupport()
      ? await this.resolveModel()
      : this.modelFactory.create(this.config);
    return model.embedBatch(texts);
  }

  async embedWithRetry(text: string, retries = 2): Promise<Float32Array> {
    let attempts = 0;

    while (attempts <= retries) {
      try {
        return await this.embed(text);
      } catch (error) {
        if (attempts >= retries) {
          throw error;
        }
        attempts += 1;
      }
    }

    throw new Error('embedding failed after retry attempts');
  }
}

export class LocalEmbeddingService implements EmbeddingService {
  readonly provider: string;
  readonly modelVersion?: string;
  readonly dimension: number;

  private readonly model: EmbeddingModel;

  constructor(config: EmbeddingProviderConfig) {
    if (!config || typeof config !== 'object') {
      throw new Error('EmbeddingProviderConfig is required');
    }
    if (!config.provider || !config.provider.trim()) {
      throw new Error('provider is required');
    }
    if (!Number.isInteger(config.dimension) || config.dimension <= 0) {
      throw new Error('dimension must be a positive integer');
    }

    this.provider = config.provider.trim();
    this.modelVersion = config.modelVersion?.trim() || undefined;
    this.dimension = config.dimension;
    this.model = new DeterministicLocalEmbeddingModel(this.dimension);
  }

  async embed(text: string): Promise<Float32Array> {
    return this.model.embed(text);
  }

  async embedBatch(texts: string[]): Promise<Float32Array[]> {
    return this.model.embedBatch(texts);
  }

  async embedWithRetry(text: string, retries = 2): Promise<Float32Array> {
    let attempts = 0;

    while (attempts <= retries) {
      try {
        return await this.embed(text);
      } catch (error) {
        if (attempts >= retries) {
          throw error;
        }
        attempts += 1;
      }
    }

    throw new Error('embedding failed after retry attempts');
  }
}
