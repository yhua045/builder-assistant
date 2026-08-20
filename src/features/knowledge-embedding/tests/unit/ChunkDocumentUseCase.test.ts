import { ChunkDocumentUseCase } from '../../application/ChunkDocumentUseCase';
import { InMemoryDocumentChunkingWorkflowRepository } from '../../infrastructure/repository/InMemoryDocumentChunkingWorkflowRepository';
import type { ChunkRepository } from '../../../../shared/infrastructure/repositories/DrizzleChunkRepository';
import type { KnowledgeChunk } from '../../../../shared/domain/entities/KnowledgeChunk';

describe('ChunkDocumentUseCase', () => {
  it('does not create chunks for a version that failed validation', async () => {
    const workflowRepository = new InMemoryDocumentChunkingWorkflowRepository();
    await workflowRepository.upsert({
      id: 'version-1',
      documentId: 'doc-1',
      documentVersion: 1,
      projectId: 'project-1',
      status: 'failed',
      workflowState: 'validation_failed',
      retryCount: 0,
      circuitOpen: false,
      supportedForAnalysis: false,
      validationReason: 'unsupported_file_type',
      isAlreadyAnalyzed: false,
      resumeFromCheckpoint: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const chunkRepository: Partial<ChunkRepository> = {
      findByDocumentVersion: jest.fn().mockResolvedValue([]),
      saveMany: jest.fn().mockResolvedValue(undefined),
      markSuperseded: jest.fn().mockResolvedValue(undefined),
    };

    const useCase = new ChunkDocumentUseCase({
      workflowRepository,
      chunkRepository: chunkRepository as ChunkRepository,
    });

    const result = await useCase.execute({
      documentId: 'doc-1',
      documentVersionId: 'version-1',
      documentVersion: 1,
      projectId: 'project-1',
      rawText: 'alpha beta gamma',
      validationStatus: 'failed',
    });

    expect(result.status).toBe('failed');
    expect(result.chunks).toEqual([]);
    expect(chunkRepository.saveMany).not.toHaveBeenCalled();
  });

  it('chunks validated raw text and persists the active chunk set for the version', async () => {
    const workflowRepository = new InMemoryDocumentChunkingWorkflowRepository();
    await workflowRepository.upsert({
      id: 'version-2',
      documentId: 'doc-2',
      documentVersion: 1,
      projectId: 'project-2',
      status: 'validated',
      workflowState: 'validation_passed',
      retryCount: 0,
      circuitOpen: false,
      supportedForAnalysis: true,
      validationReason: 'Document passed validation',
      isAlreadyAnalyzed: false,
      resumeFromCheckpoint: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const chunkRepository: Partial<ChunkRepository> = {
      findByDocumentVersion: jest.fn().mockResolvedValue([]),
      saveMany: jest.fn().mockResolvedValue(undefined),
      markSuperseded: jest.fn().mockResolvedValue(undefined),
    };

    const useCase = new ChunkDocumentUseCase({
      workflowRepository,
      chunkRepository: chunkRepository as ChunkRepository,
    });

    const result = await useCase.execute({
      documentId: 'doc-2',
      documentVersionId: 'version-2',
      documentVersion: 1,
      projectId: 'project-2',
      rawText: 'This is the first sentence for chunking. This is the second sentence for chunking. This is the third sentence for chunking.',
      validationStatus: 'passed',
    });

    expect(result.status).toBe('chunked');
    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.workflowState).toBe('chunking_complete');
    expect(chunkRepository.saveMany).toHaveBeenCalledTimes(1);
  });

  it('supersedes prior chunks when the same version is retried', async () => {
    const workflowRepository = new InMemoryDocumentChunkingWorkflowRepository();
    await workflowRepository.upsert({
      id: 'version-3',
      documentId: 'doc-3',
      documentVersion: 1,
      projectId: 'project-3',
      status: 'validated',
      workflowState: 'validation_passed',
      retryCount: 1,
      circuitOpen: false,
      supportedForAnalysis: true,
      validationReason: 'Document passed validation',
      isAlreadyAnalyzed: false,
      resumeFromCheckpoint: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const previousChunks: KnowledgeChunk[] = [
      {
        id: 'doc-3-v1-chunk-0',
        documentId: 'doc-3',
        documentVersion: 1,
        projectId: 'project-3',
        content: 'old chunk content',
        chunkIndex: 0,
        wordCount: 3,
        charCount: 17,
        tokenCount: 3,
        isOutdated: false,
        isSuperseded: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const chunkRepository: Partial<ChunkRepository> = {
      findByDocumentVersion: jest.fn().mockResolvedValue(previousChunks),
      saveMany: jest.fn().mockResolvedValue(undefined),
      markSuperseded: jest.fn().mockResolvedValue(undefined),
    };

    const useCase = new ChunkDocumentUseCase({
      workflowRepository,
      chunkRepository: chunkRepository as ChunkRepository,
    });

    const result = await useCase.execute({
      documentId: 'doc-3',
      documentVersionId: 'version-3',
      documentVersion: 1,
      projectId: 'project-3',
      rawText: 'The retry text is longer and should replace the previous chunk set for this version.',
      validationStatus: 'passed',
    });

    expect(result.status).toBe('chunked');
    expect(chunkRepository.markSuperseded).toHaveBeenCalledWith(
      ['doc-3-v1-chunk-0'],
      expect.any(String),
      expect.any(Date),
    );
    expect(chunkRepository.saveMany).toHaveBeenCalledTimes(1);
  });
});
