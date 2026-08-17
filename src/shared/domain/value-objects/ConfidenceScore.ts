export class ConfidenceScore {
  readonly value: number;

  constructor(value: number) {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new Error('ConfidenceScore must be a number between 0 and 1');
    }
    this.value = value;
  }

  toNumber(): number {
    return this.value;
  }
}
