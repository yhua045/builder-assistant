export interface ChunkDocumentProgress {
  documentId: string;
  documentVersion: number;
  processingScope: string;
  completedUnitIds: string[];
  selectedStrategy?: string;
  fallbackEvents: Array<{ unitId: string; strategy: string; reason: string }>;
  failures: Array<{ unitId: string; strategy: string; reason: string; retryCount: number }>;
  updatedAt: number;
}

export interface ChunkDocumentProgressRepository {
  load(documentId: string, documentVersion: number, processingScope: string): Promise<ChunkDocumentProgress | null>;
  saveUnitCompleted(progress: ChunkDocumentProgress, unitId: string): Promise<void>;
  recordFailure(progress: ChunkDocumentProgress, failure: ChunkDocumentProgress['failures'][number]): Promise<void>;
  recordFallback(progress: ChunkDocumentProgress, fallback: ChunkDocumentProgress['fallbackEvents'][number]): Promise<void>;
}