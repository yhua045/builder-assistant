export class EmbeddingVector {
  readonly values: number[];

  constructor(values: number[]) {
    if (!Array.isArray(values) || values.length === 0) {
      throw new Error('EmbeddingVector values are required');
    }
    if (!values.every(value => Number.isFinite(value))) {
      throw new Error('EmbeddingVector values must be finite numbers');
    }
    this.values = [...values];
  }

  get length(): number {
    return this.values.length;
  }

  toArray(): number[] {
    return [...this.values];
  }
}
