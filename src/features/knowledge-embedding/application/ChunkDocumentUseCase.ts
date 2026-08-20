import { DefaultDocumentChunkingService } from '../../../shared/application/services/DocumentChunkingService';
import type { KnowledgeChunk } from '../../../shared/domain/entities/KnowledgeChunk';
import type { DocumentChunkingWorkflowRepository } from '../../../shared/domain/repositories/DocumentChunkingWorkflowRepository';
import { DrizzleDocumentChunkingWorkflowRepository } from '../../../shared/infrastructure/repositories/DrizzleDocumentChunkingWorkflowRepository';
import { DrizzleChunkRepository, type ChunkRepository } from '../../../shared/infrastructure/repositories/DrizzleChunkRepository';

export interface ChunkDocumentInput {
  documentId: string;
  documentVersionId: string;
  documentVersion: number;
  projectId?: string;
  rawText: string;
  validationStatus?: 'passed' | 'failed';
  fileName?: string;
}

export interface ChunkDocumentOutput {
  documentId: string;
  documentVersionId: string;
  documentVersion: number;
  workflowState: 'chunking_in_progress' | 'chunking_complete' | 'failed' | 'superseded';
  status: 'chunked' | 'failed';
  chunks: KnowledgeChunk[];
}

export class ChunkDocumentUseCase {
  constructor(
    private readonly deps: {
      workflowRepository?: DocumentChunkingWorkflowRepository;
      chunkRepository?: ChunkRepository;
      chunkingService?: DefaultDocumentChunkingService;
    } = {},
  ) {}

  private get workflowRepository(): DocumentChunkingWorkflowRepository {
    return this.deps.workflowRepository ?? new DrizzleDocumentChunkingWorkflowRepository();
  }

  private get chunkRepository(): ChunkRepository {
    return this.deps.chunkRepository ?? new DrizzleChunkRepository();
  }

  private get chunkingService(): DefaultDocumentChunkingService {
    return this.deps.chunkingService ?? new DefaultDocumentChunkingService();
  }

  async execute(input: ChunkDocumentInput): Promise<ChunkDocumentOutput> {
    const version = input.documentVersion ?? 1;

    const workflowRecord = await this.workflowRepository.findByDocumentVersion(input.documentId, version);
    const validationPassed = input.validationStatus === 'passed' || workflowRecord?.status === 'validated' || workflowRecord?.workflowState === 'validation_passed';

    if (!validationPassed) {
      await this.workflowRepository.upsert({
        id: input.documentVersionId,
        documentId: input.documentId,
        documentVersion: version,
        projectId: input.projectId,
        status: 'failed',
        workflowState: 'failed',
        checkpointId: input.documentVersionId,
        lastEvent: 'failed',
        retryCount: workflowRecord?.retryCount ?? 0,
        circuitOpen: false,
        supportedForAnalysis: false,
        validationReason: 'validation_failed',
        isAlreadyAnalyzed: false,
        resumeFromCheckpoint: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      return {
        documentId: input.documentId,
        documentVersionId: input.documentVersionId,
        documentVersion: version,
        workflowState: 'failed',
        status: 'failed',
        chunks: [],
      };
    }

    const normalizedText = (input.rawText ?? '').trim();
    if (!normalizedText) {
      await this.workflowRepository.upsert({
        id: input.documentVersionId,
        documentId: input.documentId,
        documentVersion: version,
        projectId: input.projectId,
        status: 'failed',
        workflowState: 'failed',
        checkpointId: input.documentVersionId,
        lastEvent: 'failed',
        retryCount: workflowRecord?.retryCount ?? 0,
        circuitOpen: false,
        supportedForAnalysis: true,
        validationReason: 'empty_document',
        isAlreadyAnalyzed: false,
        resumeFromCheckpoint: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      return {
        documentId: input.documentId,
        documentVersionId: input.documentVersionId,
        documentVersion: version,
        workflowState: 'failed',
        status: 'failed',
        chunks: [],
      };
    }

    await this.workflowRepository.upsert({
      id: input.documentVersionId,
      documentId: input.documentId,
      documentVersion: version,
      projectId: input.projectId,
      status: 'started',
      workflowState: 'chunking_in_progress',
      checkpointId: input.documentVersionId,
      lastEvent: 'chunking_in_progress',
      retryCount: workflowRecord?.retryCount ?? 0,
      circuitOpen: false,
      supportedForAnalysis: true,
      validationReason: 'Document passed validation',
      isAlreadyAnalyzed: false,
      resumeFromCheckpoint: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const chunks = await this.chunkingService.chunkDocument({
      documentId: input.documentId,
      documentVersion: version,
      projectId: input.projectId,
      rawText: normalizedText,
      config: {
        targetMinWords: 80,
        targetMaxWords: 600,
        hardMaxWords: 900,
        mergeThresholdWords: 40,
        preferBoundary: ['paragraph', 'sentence', 'word'],
        chunkOverlapWords: 40,
      },
    });

    const previousChunks = await this.chunkRepository.findByDocumentVersion(input.documentId, version);
    if (previousChunks.length > 0) {
      const oldChunkIds = previousChunks.map(chunk => chunk.id);
      const newerChunkId = chunks[0]?.id ?? oldChunkIds[0];
      if (newerChunkId) {
        await this.chunkRepository.markSuperseded(oldChunkIds, newerChunkId, new Date());
      }
    }

    await this.chunkRepository.saveMany(chunks);

    await this.workflowRepository.upsert({
      id: input.documentVersionId,
      documentId: input.documentId,
      documentVersion: version,
      projectId: input.projectId,
      status: 'chunked',
      workflowState: 'chunking_complete',
      checkpointId: input.documentVersionId,
      lastEvent: 'chunking_complete',
      retryCount: workflowRecord?.retryCount ?? 0,
      circuitOpen: false,
      supportedForAnalysis: true,
      validationReason: 'Document passed validation',
      isAlreadyAnalyzed: false,
      resumeFromCheckpoint: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return {
      documentId: input.documentId,
      documentVersionId: input.documentVersionId,
      documentVersion: version,
      workflowState: 'chunking_complete',
      status: 'chunked',
      chunks,
    };
  }
}
