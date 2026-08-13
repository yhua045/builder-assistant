export class NormalizedFactText {
  readonly value: string;

  constructor(value: string) {
    const normalized = value?.trim() ?? '';
    if (!normalized) {
      throw new Error('NormalizedFactText value is required');
    }
    this.value = normalized.replace(/\s+/g, ' ');
  }

  toString(): string {
    return this.value;
  }
}
