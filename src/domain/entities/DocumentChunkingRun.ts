export type DocumentChunkingRunStatus = 'queued' | 'started' | 'completed' | 'failed' | 'superseded';

export interface DocumentChunkingRun {
  id: string;
  documentId: string;
  documentVersion: number;
  status: DocumentChunkingRunStatus;
  startedAt?: Date;
  completedAt?: Date;
  failureReason?: string;
  chunkCount?: number;
  createdAt: Date;
}

export class DocumentChunkingRunEntity {
  private constructor(private readonly run: DocumentChunkingRun) {}

  static create(payload: Omit<DocumentChunkingRun, 'createdAt'> & { createdAt?: Date }): DocumentChunkingRunEntity {
    const normalized: DocumentChunkingRun = {
      ...payload,
      documentVersion: payload.documentVersion ?? 1,
      status: payload.status ?? 'queued',
      createdAt: payload.createdAt ?? new Date(),
    };

    DocumentChunkingRunEntity.validate(normalized);
    return new DocumentChunkingRunEntity(normalized);
  }

  static fromData(run: DocumentChunkingRun): DocumentChunkingRunEntity {
    DocumentChunkingRunEntity.validate(run);
    return new DocumentChunkingRunEntity({ ...run });
  }

  data(): DocumentChunkingRun {
    return { ...this.run };
  }

  private static validate(run: DocumentChunkingRun): void {
    if (!run.id || run.id.trim().length === 0) {
      throw new Error('DocumentChunkingRun id is required');
    }
    if (!run.documentId || run.documentId.trim().length === 0) {
      throw new Error('DocumentChunkingRun documentId is required');
    }
    if (run.documentVersion < 1) {
      throw new Error('DocumentChunkingRun documentVersion must be >= 1');
    }
    if (!run.createdAt || Number.isNaN(run.createdAt.getTime())) {
      throw new Error('DocumentChunkingRun createdAt is required');
    }
  }
}
