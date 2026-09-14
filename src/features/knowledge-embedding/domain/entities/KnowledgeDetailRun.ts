export type KnowledgeDetailRunStatus = 'pending' | 'running' | 'completed' | 'partial' | 'failed' | 'cancelled';
export type KnowledgeDetailRunStage = 'parsing' | 'understanding' | 'chunking' | 'embedding' | 'indexing';

export interface KnowledgeDetailRun {
  id: string;
  runId: string;
  stage: KnowledgeDetailRunStage;
  status: KnowledgeDetailRunStatus;
  startedAt?: Date;
  completedAt?: Date;
  itemsTotal?: number;
  itemsProcessed?: number;
  itemsSucceeded?: number;
  itemsFailed?: number;
  errorMessage?: string;
  retryCount?: number;
  checkpoint?: string;
  createdAt: Date;
  updatedAt?: Date;
}

export class KnowledgeDetailRunEntity {
  private constructor(private readonly run: KnowledgeDetailRun) {}

  static create(payload: Omit<KnowledgeDetailRun, 'createdAt' | 'updatedAt'> & { createdAt?: Date; updatedAt?: Date }): KnowledgeDetailRunEntity {
    const normalized: KnowledgeDetailRun = {
      ...payload,
      status: payload.status ?? 'pending',
      retryCount: payload.retryCount ?? 0,
      createdAt: payload.createdAt ?? new Date(),
      updatedAt: payload.updatedAt ?? new Date(),
    };

    KnowledgeDetailRunEntity.validate(normalized);
    return new KnowledgeDetailRunEntity(normalized);
  }

  static fromData(run: KnowledgeDetailRun): KnowledgeDetailRunEntity {
    KnowledgeDetailRunEntity.validate(run);
    return new KnowledgeDetailRunEntity({ ...run });
  }

  data(): KnowledgeDetailRun {
    return { ...this.run };
  }

  start(): KnowledgeDetailRun {
    const now = new Date();
    const next: KnowledgeDetailRun = {
      ...this.run,
      status: 'running',
      startedAt: this.run.startedAt ?? now,
      updatedAt: now,
      errorMessage: undefined,
    };

    KnowledgeDetailRunEntity.validate(next);
    return next;
  }

  complete(): KnowledgeDetailRun {
    const now = new Date();
    const next: KnowledgeDetailRun = {
      ...this.run,
      status: 'completed',
      completedAt: now,
      updatedAt: now,
      errorMessage: undefined,
    };

    KnowledgeDetailRunEntity.validate(next);
    return next;
  }

  fail(errorMessage: string): KnowledgeDetailRun {
    if (!errorMessage || errorMessage.trim().length === 0) {
      throw new Error('KnowledgeDetailRun failure reason is required');
    }

    const now = new Date();
    const next: KnowledgeDetailRun = {
      ...this.run,
      status: 'failed',
      completedAt: now,
      updatedAt: now,
      errorMessage,
    };

    KnowledgeDetailRunEntity.validate(next);
    return next;
  }

  retry(): KnowledgeDetailRun {
    if (this.run.status !== 'failed' && this.run.status !== 'partial') {
      throw new Error('KnowledgeDetailRun can only retry from failed or partial state');
    }

    const now = new Date();
    const next: KnowledgeDetailRun = {
      ...this.run,
      status: 'running',
      retryCount: (this.run.retryCount ?? 0) + 1,
      startedAt: this.run.startedAt ?? now,
      updatedAt: now,
      errorMessage: undefined,
    };

    KnowledgeDetailRunEntity.validate(next);
    return next;
  }

  private static validate(run: KnowledgeDetailRun): void {
    if (!run.id || run.id.trim().length === 0) {
      throw new Error('KnowledgeDetailRun id is required');
    }
    if (!run.runId || run.runId.trim().length === 0) {
      throw new Error('KnowledgeDetailRun runId is required');
    }
    if (!run.stage || run.stage.trim().length === 0) {
      throw new Error('KnowledgeDetailRun stage is required');
    }
    if (!run.createdAt || Number.isNaN(run.createdAt.getTime())) {
      throw new Error('KnowledgeDetailRun createdAt is required');
    }
    if (run.retryCount !== undefined && run.retryCount < 0) {
      throw new Error('KnowledgeDetailRun retryCount cannot be negative');
    }
    if (run.status === 'failed' && (!run.errorMessage || run.errorMessage.trim().length === 0)) {
      throw new Error('KnowledgeDetailRun errorMessage is required when status is failed');
    }
  }
}
