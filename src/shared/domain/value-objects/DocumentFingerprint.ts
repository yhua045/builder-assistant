export class DocumentFingerprint {
  readonly value: string;

  constructor(value: string) {
    const normalized = value?.trim() ?? '';
    if (!normalized) {
      throw new Error('DocumentFingerprint value is required');
    }
    this.value = normalized;
  }

  toString(): string {
    return this.value;
  }
}
