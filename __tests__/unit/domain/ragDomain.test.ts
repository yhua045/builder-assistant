import { AnalysisRunEntity } from '../../../src/domain/entities/AnalysisRun';
import { AnalysisCheckpointEntity } from '../../../src/domain/entities/AnalysisCheckpoint';
import { DocumentAnalysisEntity } from '../../../src/domain/entities/DocumentAnalysis';
import { ProjectFactEntity } from '../../../src/domain/entities/ProjectFact';
import { KnowledgeEmbeddingEntity } from '../../../src/domain/entities/KnowledgeEmbedding';
import { KnowledgeChunkEntity } from '../../../src/domain/entities/KnowledgeChunk';

describe('RAG domain entities', () => {
  it('creates valid AnalysisRun and DocumentAnalysis records', () => {
    const run = AnalysisRunEntity.create({
      id: 'run-1',
      projectId: 'project-1',
      status: 'queued',
      startedAt: new Date('2026-01-01T00:00:00Z'),
      documentIds: ['doc-1', 'doc-2'],
      checkpointIds: ['cp-1'],
    });

    const analysis = DocumentAnalysisEntity.create({
      id: 'analysis-1',
      documentId: 'doc-1',
      analysisRunId: 'run-1',
      status: 'queued',
      summary: 'Found key schedule items.',
      language: 'en',
      confidence: 0.92,
      startedAt: new Date('2026-01-01T00:00:00Z'),
    });

    expect(run.data().projectId).toBe('project-1');
    expect(analysis.data().summary).toContain('schedule');
  });

  it('rejects duplicate document refs in an analysis run', () => {
    expect(() =>
      AnalysisRunEntity.create({
        id: 'run-2',
        projectId: 'project-1',
        status: 'running',
        startedAt: new Date(),
        documentIds: ['doc-1', 'doc-1'],
        checkpointIds: [],
      })
    ).toThrow('Analysis run documentIds must be unique');
  });

  it('rejects invalid fact text and mismatched embedding dimensions', () => {
    expect(() =>
      ProjectFactEntity.create({
        id: 'fact-1',
        projectId: 'project-1',
        factType: 'scope',
        canonicalText: '   ',
        status: 'proposed',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    ).toThrow('ProjectFact canonicalText is required');

    expect(() =>
      KnowledgeEmbeddingEntity.create({
        id: 'emb-1',
        chunkId: 'chunk-1',
        vector: [0.1, 0.2],
        dimension: 3,
        createdAt: new Date(),
      })
    ).toThrow('KnowledgeEmbedding.dimension must match vector length');

    expect(() =>
      KnowledgeChunkEntity.create({
        id: 'chunk-1',
        documentId: 'doc-1',
        content: '',
        chunkIndex: 0,
      })
    ).toThrow('KnowledgeChunk content is required');
  });

  it('stores checkpoint metadata and validates checkpoint type', () => {
    const checkpoint = AnalysisCheckpointEntity.create({
      id: 'cp-1',
      analysisRunId: 'run-1',
      type: 'facts_generated',
      message: 'Generated 4 facts',
      createdAt: new Date(),
    });

    expect(checkpoint.data().type).toBe('facts_generated');
  });
});
