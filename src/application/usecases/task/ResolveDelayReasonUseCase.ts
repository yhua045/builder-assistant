import { TaskRepository } from '../../../domain/repositories/TaskRepository';

export interface ResolveDelayReasonInput {
  delayReasonId: string;
  resolvedAt?: string;       // ISO date string; defaults to now
  mitigationNotes?: string;
}

export class ResolveDelayReasonUseCase {
  constructor(private readonly taskRepository: TaskRepository) {}

  async execute(input: ResolveDelayReasonInput): Promise<void> {
    const { delayReasonId, resolvedAt, mitigationNotes } = input;
    const ts = resolvedAt ?? new Date().toISOString();
    await this.taskRepository.resolveDelayReason(delayReasonId, ts, mitigationNotes);
  }
}
