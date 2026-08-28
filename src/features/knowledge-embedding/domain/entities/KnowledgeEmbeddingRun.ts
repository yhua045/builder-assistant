import { KnowledgeDetailRunEntity, type KnowledgeDetailRun } from './KnowledgeDetailRun';

export type KnowledgeEmbeddingRunStatus = 'pending' | 'running' | 'completed' | 'partial' | 'failed' | 'cancelled';
export type KnowledgeEmbeddingRunStage = 'parsing' | 'understanding' | 'chunking' | 'embedding' | 'indexing';

export interface KnowledgeEmbeddingRun {
  id: string;
  documentId: string;
  status: KnowledgeEmbeddingRunStatus;
  currentStage?: KnowledgeEmbeddingRunStage;
  startedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
  createdAt: Date;
  updatedAt?: Date;
}

export class KnowledgeEmbeddingRunEntity {
  private constructor(private readonly run: KnowledgeEmbeddingRun) {}

  static create(payload: Omit<KnowledgeEmbeddingRun, 'createdAt' | 'updatedAt'> & { createdAt?: Date; updatedAt?: Date }): KnowledgeEmbeddingRunEntity {
    const normalized: KnowledgeEmbeddingRun = {
      ...payload,
      status: payload.status ?? 'pending',
      createdAt: payload.createdAt ?? new Date(),
      updatedAt: payload.updatedAt ?? new Date(),
    };

    KnowledgeEmbeddingRunEntity.validate(normalized);
    return new KnowledgeEmbeddingRunEntity(normalized);
  }

  static fromData(run: KnowledgeEmbeddingRun): KnowledgeEmbeddingRunEntity {
    KnowledgeEmbeddingRunEntity.validate(run);
    return new KnowledgeEmbeddingRunEntity({ ...run });
  }

  data(): KnowledgeEmbeddingRun {
    return { ...this.run };
  }

  createDetailRun(payload: Omit<KnowledgeDetailRun, 'runId' | 'createdAt' | 'updatedAt'> & { runId?: string; createdAt?: Date; updatedAt?: Date }): KnowledgeDetailRun {
    const parent = this.data();
    const childRun = KnowledgeDetailRunEntity.create({
      ...payload,
      runId: payload.runId ?? parent.id,
      status: payload.status ?? 'pending',
      retryCount: payload.retryCount ?? 0,
      createdAt: payload.createdAt ?? new Date(),
      updatedAt: payload.updatedAt ?? new Date(),
    });

    KnowledgeEmbeddingRunEntity.validateParentChildConsistency(parent, childRun.data());
    return childRun.data();
  }

  start(stage: KnowledgeEmbeddingRunStage): KnowledgeEmbeddingRun {
    const now = new Date();
    const next: KnowledgeEmbeddingRun = {
      ...this.run,
      status: 'running',
      currentStage: stage,
      startedAt: this.run.startedAt ?? now,
      updatedAt: now,
      errorMessage: undefined,
    };

    KnowledgeEmbeddingRunEntity.validate(next);
    return next;
  }

  complete(): KnowledgeEmbeddingRun {
    const now = new Date();
    const next: KnowledgeEmbeddingRun = {
      ...this.run,
      status: 'completed',
      currentStage: this.run.currentStage ?? 'indexing',
      completedAt: now,
      updatedAt: now,
      errorMessage: undefined,
    };

    KnowledgeEmbeddingRunEntity.validate(next);
    return next;
  }

  restartOrResume(): KnowledgeEmbeddingRun {
    if (this.run.status !== 'running' && this.run.status !== 'partial') {
      throw new Error('KnowledgeEmbeddingRun can only restart or resume while active or partial');
    }

    const now = new Date();
    const next: KnowledgeEmbeddingRun = {
      ...this.run,
      status: 'running',
      startedAt: this.run.startedAt ?? now,
      updatedAt: now,
      errorMessage: undefined,
    };

    KnowledgeEmbeddingRunEntity.validate(next);
    return next;
  }

  retryActiveStage(): KnowledgeEmbeddingRun {
    this.validateRetryEligibility();

    const now = new Date();
    const next: KnowledgeEmbeddingRun = {
      ...this.run,
      status: 'running',
      startedAt: this.run.startedAt ?? now,
      updatedAt: now,
      errorMessage: undefined,
    };

    KnowledgeEmbeddingRunEntity.validate(next);
    return next;
  }

  validateRetryEligibility(): void {
    if (this.run.status === 'completed' || this.run.status === 'cancelled') {
      throw new Error('KnowledgeEmbeddingRun retry is only allowed while active or partial');
    }

    if ((this.run.status === 'failed' || this.run.status === 'partial' || this.run.status === 'running') && !this.run.currentStage) {
      throw new Error('KnowledgeEmbeddingRun currentStage is required before retrying a step');
    }
  }

  fail(errorMessage: string): KnowledgeEmbeddingRun {
    if (!errorMessage || errorMessage.trim().length === 0) {
      throw new Error('KnowledgeEmbeddingRun failure reason is required');
    }

    const now = new Date();
    const next: KnowledgeEmbeddingRun = {
      ...this.run,
      status: 'failed',
      completedAt: now,
      updatedAt: now,
      errorMessage,
    };

    KnowledgeEmbeddingRunEntity.validate(next);
    return next;
  }

  private static validateParentChildConsistency(parent: KnowledgeEmbeddingRun, child: KnowledgeDetailRun): void {
    if (!parent.id || parent.id.trim().length === 0) {
      throw new Error('KnowledgeEmbeddingRun parent id is required');
    }
    if (!child.runId || child.runId.trim().length === 0) {
      throw new Error('KnowledgeDetailRun runId is required');
    }
    if (child.runId !== parent.id) {
      throw new Error('KnowledgeDetailRun runId must match the parent KnowledgeEmbeddingRun id');
    }
    if (parent.status === 'completed' || parent.status === 'cancelled') {
      throw new Error('Cannot create child detail runs for a completed or cancelled KnowledgeEmbeddingRun');
    }
    if (parent.status === 'failed' && child.status !== 'failed') {
      throw new Error('Cannot create a non-failed child detail run when the parent KnowledgeEmbeddingRun is failed');
    }
  }

  private static validate(run: KnowledgeEmbeddingRun): void {
    if (!run.id || run.id.trim().length === 0) {
      throw new Error('KnowledgeEmbeddingRun id is required');
    }
    if (!run.documentId || run.documentId.trim().length === 0) {
      throw new Error('KnowledgeEmbeddingRun documentId is required');
    }
    if (!run.createdAt || Number.isNaN(run.createdAt.getTime())) {
      throw new Error('KnowledgeEmbeddingRun createdAt is required');
    }
    if (run.status === 'failed' && (!run.errorMessage || run.errorMessage.trim().length === 0)) {
      throw new Error('KnowledgeEmbeddingRun errorMessage is required when status is failed');
    }
  }
}
