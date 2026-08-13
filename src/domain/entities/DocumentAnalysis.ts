export type AnalysisStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface DocumentAnalysis {
  id: string;
  documentId: string;
  analysisRunId: string;
  status: AnalysisStatus;
  summary?: string;
  language?: string;
  confidence?: number;
  startedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export class DocumentAnalysisEntity {
  private constructor(private readonly analysis: DocumentAnalysis) {}

  static create(payload: Omit<DocumentAnalysis, 'createdAt' | 'updatedAt'> & { createdAt?: Date; updatedAt?: Date }): DocumentAnalysisEntity {
    const now = new Date();
    const analysis: DocumentAnalysis = {
      ...payload,
      createdAt: payload.createdAt ?? now,
      updatedAt: payload.updatedAt ?? now,
    };

    DocumentAnalysisEntity.validate(analysis);
    return new DocumentAnalysisEntity(analysis);
  }

  static fromData(analysis: DocumentAnalysis): DocumentAnalysisEntity {
    DocumentAnalysisEntity.validate(analysis);
    return new DocumentAnalysisEntity({ ...analysis });
  }

  data(): DocumentAnalysis {
    return { ...this.analysis };
  }

  private static validate(analysis: DocumentAnalysis): void {
    if (!analysis.id || analysis.id.trim().length === 0) {
      throw new Error('DocumentAnalysis id is required');
    }
    if (!analysis.documentId || analysis.documentId.trim().length === 0) {
      throw new Error('DocumentAnalysis documentId is required');
    }
    if (!analysis.analysisRunId || analysis.analysisRunId.trim().length === 0) {
      throw new Error('DocumentAnalysis analysisRunId is required');
    }
    if (analysis.confidence !== undefined && (analysis.confidence < 0 || analysis.confidence > 1)) {
      throw new Error('DocumentAnalysis confidence must be between 0 and 1');
    }
  }
}
