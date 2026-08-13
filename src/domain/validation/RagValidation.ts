export function assertRequired(value: string | undefined | null, label: string): void {
  if (!value || value.trim().length === 0) {
    throw new Error(`${label} is required`);
  }
}

export function assertUnique(values: readonly string[], label: string): void {
  if (values.length !== new Set(values).size) {
    throw new Error(`${label} must be unique`);
  }
}

export function assertConfidence(value: number | undefined, label: string): void {
  if (value === undefined) return;
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${label} must be between 0 and 1`);
  }
}

export function assertFiniteVector(values: number[] | undefined, label: string): void {
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error(`${label} is required`);
  }
  if (!values.every(v => Number.isFinite(v))) {
    throw new Error(`${label} values must be finite numbers`);
  }
}
