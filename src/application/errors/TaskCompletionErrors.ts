import type { Quotation } from '../../domain/entities/Quotation';

export class TaskNotFoundError extends Error {
  constructor(taskId: string) {
    super(`Task not found: ${taskId}`);
    this.name = 'TaskNotFoundError';
  }
}

export class TaskCompletionValidationError extends Error {
  readonly code = 'PENDING_QUOTATIONS' as const;
  readonly pendingQuotations: Pick<Quotation, 'id' | 'reference' | 'status'>[];

  constructor(pendingQuotations: Pick<Quotation, 'id' | 'reference' | 'status'>[]) {
    const refs = pendingQuotations.map(q => q.reference).join(', ');
    super(`Cannot complete task: unresolved quotations [${refs}]`);
    this.name = 'TaskCompletionValidationError';
    this.pendingQuotations = pendingQuotations;
  }
}
