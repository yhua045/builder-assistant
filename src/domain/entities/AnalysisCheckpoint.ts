export type AnalysisCheckpointType =
  | 'started'
  | 'document_extracted'
  | 'facts_generated'
  | 'confirmations_updated'
  | 'completed'
  | 'error';

export interface AnalysisCheckpoint {
  id: string;
  analysisRunId: string;
  type: AnalysisCheckpointType;
  message?: string;
  payload?: Record<string, unknown>;
  createdAt: Date;
}

export class AnalysisCheckpointEntity {
  private constructor(private readonly checkpoint: AnalysisCheckpoint) {}

  static create(payload: AnalysisCheckpoint): AnalysisCheckpointEntity {
    AnalysisCheckpointEntity.validate(payload);
    return new AnalysisCheckpointEntity({ ...payload });
  }

  static fromData(checkpoint: AnalysisCheckpoint): AnalysisCheckpointEntity {
    AnalysisCheckpointEntity.validate(checkpoint);
    return new AnalysisCheckpointEntity({ ...checkpoint });
  }

  data(): AnalysisCheckpoint {
    return { ...this.checkpoint };
  }

  private static validate(checkpoint: AnalysisCheckpoint): void {
    if (!checkpoint.id || checkpoint.id.trim().length === 0) {
      throw new Error('AnalysisCheckpoint id is required');
    }
    if (!checkpoint.analysisRunId || checkpoint.analysisRunId.trim().length === 0) {
      throw new Error('AnalysisCheckpoint analysisRunId is required');
    }
    if (!checkpoint.createdAt || Number.isNaN(checkpoint.createdAt.getTime())) {
      throw new Error('AnalysisCheckpoint createdAt is required');
    }
  }
}
