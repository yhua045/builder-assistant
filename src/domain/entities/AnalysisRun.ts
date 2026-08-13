export type AnalysisRunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface AnalysisRun {
  id: string;
  projectId: string;
  status: AnalysisRunStatus;
  startedAt: Date;
  completedAt?: Date;
  documentIds: string[];
  checkpointIds: string[];
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export class AnalysisRunEntity {
  private constructor(private readonly run: AnalysisRun) {}

  static create(payload: Omit<AnalysisRun, 'createdAt' | 'updatedAt'> & { createdAt?: Date; updatedAt?: Date }): AnalysisRunEntity {
    const now = new Date();
    const run: AnalysisRun = {
      ...payload,
      createdAt: payload.createdAt ?? now,
      updatedAt: payload.updatedAt ?? now,
    };

    AnalysisRunEntity.validate(run);
    return new AnalysisRunEntity(run);
  }

  static fromData(run: AnalysisRun): AnalysisRunEntity {
    AnalysisRunEntity.validate(run);
    return new AnalysisRunEntity({ ...run });
  }

  data(): AnalysisRun {
    return { ...this.run };
  }

  private static validate(run: AnalysisRun): void {
    if (!run.id || run.id.trim().length === 0) {
      throw new Error('AnalysisRun id is required');
    }
    if (!run.projectId || run.projectId.trim().length === 0) {
      throw new Error('AnalysisRun projectId is required');
    }
    if (!run.startedAt || Number.isNaN(run.startedAt.getTime())) {
      throw new Error('AnalysisRun startedAt is required');
    }
    if (run.documentIds.length !== new Set(run.documentIds).size) {
      throw new Error('Analysis run documentIds must be unique');
    }
    if (run.checkpointIds.length !== new Set(run.checkpointIds).size) {
      throw new Error('Analysis run checkpointIds must be unique');
    }
  }
}
