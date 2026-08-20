import type { DocumentChunkingWorkflowRepository } from '../../../shared/domain/repositories/DocumentChunkingWorkflowRepository';
import { DrizzleDocumentChunkingWorkflowRepository } from '../../../shared/infrastructure/repositories/DrizzleDocumentChunkingWorkflowRepository';
import type { DocumentSourceType } from '../domain/context/DocumentProcessingContext';

export interface ReceiveDocumentInput {
  sessionId: string;
  projectId?: string;
  originalFileName: string;
  sourceType: DocumentSourceType;
  mimeType?: string;
  storageKey: string;
  checksum?: string;
  uploadedAt?: string;
}

export interface ReceiveDocumentOutput {
  documentId: string;
  documentVersionId: string;
  version: number;
  workflowState: 'document_received';
  status: 'received';
}

function makeId(prefix: string): string {
  const stamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${stamp}-${random}`;
}

export class ReceiveDocumentUseCase {
  constructor(
    private readonly checkpointRepository: DocumentChunkingWorkflowRepository = new DrizzleDocumentChunkingWorkflowRepository(),
  ) {}

  async execute(input: ReceiveDocumentInput): Promise<ReceiveDocumentOutput> {
    const documentId = makeId('doc');
    const documentVersionId = makeId('doc-version');
    const output: ReceiveDocumentOutput = {
      documentId,
      documentVersionId,
      version: 1,
      workflowState: 'document_received',
      status: 'received',
    };

    await this.checkpointRepository.upsert({
      id: documentVersionId,
      documentId,
      documentVersion: output.version,
      projectId: input.projectId,
      status: output.status,
      workflowState: output.workflowState,
      lastEvent: output.workflowState,
      retryCount: 0,
      circuitOpen: false,
      supportedForAnalysis: undefined,
      validationReason: undefined,
      isAlreadyAnalyzed: false,
      resumeFromCheckpoint: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return output;
  }
}
