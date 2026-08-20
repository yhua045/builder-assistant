import type { DocumentVersion } from '../../../shared/domain/entities/DocumentVersion';
import type { DocumentChunkingWorkflowRepository } from '../../../shared/domain/repositories/DocumentChunkingWorkflowRepository';
import { DrizzleDocumentChunkingWorkflowRepository } from '../../../shared/infrastructure/repositories/DrizzleDocumentChunkingWorkflowRepository';
import type { DocumentSourceType } from '../domain/context/DocumentProcessingContext';
import { FileTypeValidator } from '../infrastructure/validation/FileTypeValidator';
import { SizeAndSanityValidator } from '../infrastructure/validation/SizeAndSanityValidator';

export interface ValidateDocumentInput {
  documentId: string;
  documentVersionId: string;
  sessionId?: string;
  storageKey: string;
  sourceType: DocumentSourceType;
  mimeType?: string;
  fileSizeBytes?: number;
}

export interface ValidateDocumentOutput {
  documentId: string;
  documentVersionId: string;
  version: number;
  isSupported: boolean;
  status: 'passed' | 'failed';
  validationStatus: 'passed' | 'failed';
  rejectionCode?: string;
  reason?: string;
  warnings: string[];
  updatedVersion: DocumentVersion;
}

export class ValidateDocumentUseCase {
  constructor(
    private readonly checkpointRepository: DocumentChunkingWorkflowRepository = new DrizzleDocumentChunkingWorkflowRepository(),
  ) {}

  private readonly fileTypeValidator = new FileTypeValidator();
  private readonly sizeAndSanityValidator = new SizeAndSanityValidator();

  async execute(input: ValidateDocumentInput): Promise<ValidateDocumentOutput> {
    const version = 1;
    const storageKey = input.storageKey ?? '';
    const mimeType = input.mimeType ?? '';

    const sanity = this.sizeAndSanityValidator.validate({
      storageKey,
      fileSizeBytes: input.fileSizeBytes,
      exists: !storageKey.toLowerCase().includes('missing'),
    });

    if (!sanity.isValid) {
      const updatedVersion = {
        id: input.documentVersionId,
        documentId: input.documentId,
        version,
        status: 'failed',
        workflowState: 'validation_failed',
        sourceType: input.sourceType,
        supportedForAnalysis: false,
        validationStatus: 'failed',
        validationReason: sanity.reason,
        rejectionCode: sanity.rejectionCode,
        validatedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as DocumentVersion;

      const result: ValidateDocumentOutput = {
        documentId: input.documentId,
        documentVersionId: input.documentVersionId,
        version,
        isSupported: false,
        status: 'failed',
        validationStatus: 'failed',
        rejectionCode: sanity.rejectionCode,
        reason: sanity.reason,
        warnings: sanity.warnings,
        updatedVersion,
      };

      await this.checkpointRepository.upsert({
        id: input.documentVersionId,
        documentId: input.documentId,
        documentVersion: version,
        projectId: undefined,
        status: result.status,
        workflowState: updatedVersion.workflowState,
        lastEvent: updatedVersion.workflowState,
        retryCount: 0,
        circuitOpen: false,
        supportedForAnalysis: updatedVersion.supportedForAnalysis,
        validationReason: updatedVersion.validationReason,
        isAlreadyAnalyzed: false,
        resumeFromCheckpoint: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      return result;
    }

    const typeCheck = this.fileTypeValidator.validate(input.sourceType, mimeType, storageKey);

    if (!typeCheck.isSupported) {
      const updatedVersion = {
        id: input.documentVersionId,
        documentId: input.documentId,
        version,
        status: 'failed',
        workflowState: 'validation_failed',
        sourceType: input.sourceType,
        supportedForAnalysis: false,
        validationStatus: 'failed',
        validationReason: typeCheck.reason,
        rejectionCode: typeCheck.rejectionCode,
        validatedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as DocumentVersion;

      const result: ValidateDocumentOutput = {
        documentId: input.documentId,
        documentVersionId: input.documentVersionId,
        version,
        isSupported: false,
        status: 'failed',
        validationStatus: 'failed',
        rejectionCode: typeCheck.rejectionCode,
        reason: typeCheck.reason,
        warnings: typeCheck.warnings,
        updatedVersion,
      };

      await this.checkpointRepository.upsert({
        id: input.documentVersionId,
        documentId: input.documentId,
        documentVersion: version,
        projectId: undefined,
        status: updatedVersion.status,
        workflowState: updatedVersion.workflowState,
        lastEvent: updatedVersion.workflowState,
        retryCount: 0,
        circuitOpen: false,
        supportedForAnalysis: updatedVersion.supportedForAnalysis,
        validationReason: updatedVersion.validationReason,
        isAlreadyAnalyzed: false,
        resumeFromCheckpoint: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      return result;
    }

    const updatedVersion = {
      id: input.documentVersionId,
      documentId: input.documentId,
      version,
      status: 'validated',
      workflowState: 'validation_passed',
      sourceType: input.sourceType,
      supportedForAnalysis: true,
      validationStatus: 'passed',
      validationReason: 'Document passed validation',
      validatedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as DocumentVersion;

    const result: ValidateDocumentOutput = {
      documentId: input.documentId,
      documentVersionId: input.documentVersionId,
      version,
      isSupported: true,
      status: 'passed',
      validationStatus: 'passed',
      rejectionCode: undefined,
      reason: 'Document passed validation',
      warnings: [],
      updatedVersion,
    };

    await this.checkpointRepository.upsert({
      id: input.documentVersionId,
      documentId: input.documentId,
      documentVersion: version,
      projectId: undefined,
      status: updatedVersion.status,
      workflowState: updatedVersion.workflowState,
      lastEvent: updatedVersion.workflowState,
      retryCount: 0,
      circuitOpen: false,
      supportedForAnalysis: updatedVersion.supportedForAnalysis,
      validationReason: updatedVersion.validationReason,
      isAlreadyAnalyzed: false,
      resumeFromCheckpoint: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return result;
  }
}
