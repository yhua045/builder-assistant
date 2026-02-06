export class ValidationError extends Error {
  public readonly details?: string[];
  constructor(message: string, details?: string[]) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
  }
}
