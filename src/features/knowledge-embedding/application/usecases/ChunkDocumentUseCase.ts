import { DefaultDocumentChunkingService } from '../services/DocumentChunkingService';
import type { KnowledgeChunk } from '../../domain/entities/KnowledgeChunk';
import type { DocumentChunkingWorkflowRepository } from '../../../../shared/domain/repositories/DocumentChunkingWorkflowRepository';
import type { ExtractedDocumentText } from '../../domain/entities/ExtractedDocumentText';
import type { ChunkingConfig } from '../../domain/services/DocumentChunkingService';
import type { ChunkDocumentProgress, ChunkDocumentProgressRepository } from '../../domain/repositories/ChunkDocumentProgressRepository';
import { DrizzleDocumentChunkingWorkflowRepository } from '../../infrastructure/repositories/DrizzleDocumentChunkingWorkflowRepository';
import { DrizzleChunkRepository, type ChunkRepository } from '../../infrastructure/repositories/DrizzleChunkRepository';
import { DrizzleChunkDocumentProgressRepository } from '../../infrastructure/repositories/DrizzleChunkDocumentProgressRepository';

export interface ChunkDocumentInput {
  documentId: string;
  documentVersionId: string;
  documentVersion: number;
  projectId?: string;
  rawText?: string;
  extractedDocumentText?: ExtractedDocumentText;
  processingScope?: string;
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
      progressRepository?: ChunkDocumentProgressRepository;
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

  private get progressRepository(): ChunkDocumentProgressRepository {
    return this.deps.progressRepository ?? new DrizzleChunkDocumentProgressRepository();
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

    const extracted = input.extractedDocumentText;
    const normalizedText = (extracted?.text ?? input.rawText ?? '').trim();
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

    const processingScope = input.processingScope ?? 'default';
    const progress: ChunkDocumentProgress = await this.progressRepository.load(input.documentId, version, processingScope) ?? {
      documentId: input.documentId,
      documentVersion: version,
      processingScope,
      completedUnitIds: [],
      fallbackEvents: [],
      failures: [],
      updatedAt: Date.now(),
    };
    progress.selectedStrategy = 'default-text';

    const pages = extracted?.pageMetadata?.length
      ? extracted.pageMetadata
      : [{ pageNumber: 1, text: normalizedText, startOffset: 0, endOffset: normalizedText.length }];
    const persistedChunks = await this.chunkRepository.findByDocumentVersion(input.documentId, version);
    const chunks: KnowledgeChunk[] = persistedChunks.filter(chunk => !chunk.isSuperseded);
    const newlyGeneratedChunks: KnowledgeChunk[] = [];
    let nextChunkIndex = chunks.reduce((highest, chunk) => Math.max(highest, chunk.chunkIndex + 1), 0);

    try {
      for (const page of pages) {
        const unitId = `page:${page.pageNumber}`;
        if (progress.completedUnitIds.includes(unitId)) continue;
        const existingUnitChunks = chunks.filter(chunk => chunk.metadata?.pageNumber === page.pageNumber);
        if (existingUnitChunks.length > 0) {
          await this.progressRepository.saveUnitCompleted(progress, unitId);
          continue;
        }

        const chunkingConfig: ChunkingConfig = {
          targetMinWords: 80,
          targetMaxWords: 600,
          hardMaxWords: 900,
          mergeThresholdWords: 40,
          preferBoundary: ['page', 'section', 'paragraph', 'sentence', 'word'],
          chunkOverlapWords: 40,
        };
        let unitChunks: KnowledgeChunk[];
        try {
          unitChunks = await this.chunkingService.chunkDocument({
            documentId: input.documentId,
            documentVersion: version,
            projectId: input.projectId ?? extracted?.projectId,
            rawText: page.text,
            pageMetadata: [page],
            sectionHints: extracted?.sectionHints,
            config: chunkingConfig,
          });
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          await this.progressRepository.recordFailure(progress, {
            unitId,
            strategy: progress.selectedStrategy,
            reason,
            retryCount: (workflowRecord?.retryCount ?? 0) + 1,
          });
          unitChunks = await this.chunkingService.chunkParagraphs(page.text, chunkingConfig);
          await this.progressRepository.recordFallback(progress, {
            unitId,
            strategy: 'deterministic-paragraph-fallback',
            reason,
          });
        }
        const indexedChunks = unitChunks.map(chunk => ({
          ...chunk,
          chunkIndex: nextChunkIndex++,
          id: `${input.documentId}-v${version}-chunk-${nextChunkIndex - 1}`,
        }));
        await this.chunkRepository.saveMany(indexedChunks);
        chunks.push(...indexedChunks);
        newlyGeneratedChunks.push(...indexedChunks);
        await this.progressRepository.saveUnitCompleted(progress, unitId);
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      await this.progressRepository.recordFailure(progress, {
        unitId: progress.completedUnitIds.length < pages.length ? `page:${pages[progress.completedUnitIds.length].pageNumber}` : 'unknown',
        strategy: progress.selectedStrategy,
        reason,
        retryCount: (workflowRecord?.retryCount ?? 0) + 1,
      });
      await this.workflowRepository.upsert({
        id: input.documentVersionId,
        documentId: input.documentId,
        documentVersion: version,
        projectId: input.projectId,
        status: 'failed',
        workflowState: 'failed',
        checkpointId: input.documentVersionId,
        lastEvent: 'failed',
        retryCount: (workflowRecord?.retryCount ?? 0) + 1,
        circuitOpen: false,
        supportedForAnalysis: true,
        validationReason: reason,
        isAlreadyAnalyzed: false,
        resumeFromCheckpoint: progress.completedUnitIds.length > 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      return { ...input, documentVersionId: input.documentVersionId, documentId: input.documentId, documentVersion: version, workflowState: 'failed', status: 'failed', chunks };
    }

    const previousChunks = persistedChunks.filter(chunk => !newlyGeneratedChunks.some(current => current.id === chunk.id));
    if (newlyGeneratedChunks.length > 0 && previousChunks.length > 0) {
      await this.chunkRepository.markSuperseded(previousChunks.map(chunk => chunk.id), newlyGeneratedChunks[0].id, new Date());
    }

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
