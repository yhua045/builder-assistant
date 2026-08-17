jest.mock('react-native-sqlite-storage', () => {
  function createAdapter(db: any) {
    return {
      executeSql: async (sql: string, params: any[] = []) => {
        const stmt = sql.trim();
        const upper = stmt.toUpperCase();

        if (upper.startsWith('SELECT')) {
          const rows = db.prepare(stmt).all(...params);
          return [{ rows: { length: rows.length, item: (i: number) => rows[i] } }];
        }

        if (params && params.length > 0) {
          try {
            db.prepare(stmt).run(...params);
            return [{ rows: { length: 0, item: (_: number) => undefined } }];
          } catch (error) {
            console.error('SQL Error mock (write):', error, sql, params);
            throw error;
          }
        }

        db.exec(stmt);
        return [{ rows: { length: 0, item: (_: number) => undefined } }];
      },
      transaction: async (fn: any) => {
        db.exec('BEGIN');
        try {
          const tx = { executeSql: (sql: string, params?: any[]) => createAdapter(db).executeSql(sql, params) };
          await fn(tx);
          db.exec('COMMIT');
        } catch (error) {
          db.exec('ROLLBACK');
          throw error;
        }
      },
      close: async () => db.close(),
    };
  }

  return {
    enablePromise: (_: boolean) => {},
    openDatabase: async () => {
      const BetterSqlite3 = require('better-sqlite3');
      const db = new BetterSqlite3(':memory:');
      return createAdapter(db);
    },
  };
});

import { AnalysisRunEntity } from '../../../src/shared/domain/entities/AnalysisRun';
import { AnalysisCheckpointEntity } from '../../../src/shared/domain/entities/AnalysisCheckpoint';
import { DocumentAnalysisEntity } from '../../../src/shared/domain/entities/DocumentAnalysis';
import { ProjectFactEntity } from '../../../src/shared/domain/entities/ProjectFact';
import { KnowledgeEmbeddingEntity } from '../../../src/shared/domain/entities/KnowledgeEmbedding';
import { KnowledgeChunkEntity } from '../../../src/shared/domain/entities/KnowledgeChunk';
import { DocumentVersionEntity } from '../../../src/shared/domain/entities/DocumentVersion';
import { ExtractedDocumentTextEntity } from '../../../src/shared/domain/entities/ExtractedDocumentText';
import { DocumentChunkingRunEntity } from '../../../src/shared/domain/entities/DocumentChunkingRun';
import { transitionDocumentChunkingWorkflow } from '../../../src/shared/domain/services/DocumentChunkingWorkflow';
import { DefaultDocumentChunkingService } from '../../../src/shared/application/services/DocumentChunkingService';
import { initDatabase } from '../../../src/shared/infrastructure/database/connection';
import { DrizzleDocumentChunkingWorkflowRepository } from '../../../src/shared/infrastructure/repositories/DrizzleDocumentChunkingWorkflowRepository';

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

  it('creates a document version checkpoint with validation and extraction metadata', () => {
    const version = DocumentVersionEntity.create({
      id: 'doc-version-1',
      documentId: 'doc-1',
      projectId: 'project-1',
      version: 1,
      status: 'validated',
      workflowState: 'validation_pending',
      sourceType: 'pdf',
      supportedForAnalysis: true,
      validationStatus: 'passed',
      validationReason: 'supported_document_type',
      rejectionCode: undefined,
      lastEvent: 'VALIDATION_SUCCEEDED',
      retryCount: 0,
      circuitOpen: false,
      createdAt: new Date('2026-01-01T00:00:00Z'),
    });

    expect(version.data().supportedForAnalysis).toBe(true);
    expect(version.data().validationStatus).toBe('passed');
    expect(version.data().workflowState).toBe('validation_pending');
  });

  it('stores extracted text and run metadata for the chunking slice', () => {
    const extracted = ExtractedDocumentTextEntity.create({
      id: 'extracted-1',
      documentId: 'doc-1',
      documentVersion: 1,
      projectId: 'project-1',
      text: 'First paragraph. Second paragraph.',
      pageMetadata: [
        { pageNumber: 1, text: 'First paragraph. Second paragraph.', startOffset: 0, endOffset: 36 },
      ],
      sectionHints: [{ heading: 'Summary', text: 'First paragraph.' }],
      language: 'en',
      warnings: ['normalised whitespace'],
      createdAt: new Date('2026-01-01T00:00:00Z'),
    });

    const run = DocumentChunkingRunEntity.create({
      id: 'run-doc-1-v1',
      documentId: 'doc-1',
      documentVersion: 1,
      status: 'started',
      startedAt: new Date('2026-01-01T00:00:00Z'),
      chunkCount: 2,
      createdAt: new Date('2026-01-01T00:00:00Z'),
    });

    expect(extracted.data().text).toContain('Second paragraph');
    expect(run.data().status).toBe('started');
    expect(run.data().chunkCount).toBe(2);
  });

  it('captures document_received checkpoint metadata and resume state', () => {
    const received = transitionDocumentChunkingWorkflow('idle', {
      type: 'DOCUMENT_RECEIVED',
      documentId: 'doc-123',
      documentVersion: 2,
      projectId: 'project-1',
      checkpointId: 'checkpoint-doc-123-v2',
      resumeFromCheckpoint: true,
    });

    expect(received.value).toBe('document_received');
    expect(received.context.documentId).toBe('doc-123');
    expect(received.context.documentVersion).toBe(2);
    expect(received.context.checkpointId).toBe('checkpoint-doc-123-v2');
    expect(received.context.resumeFromCheckpoint).toBe(true);
  });

  it('records validation decisions for supported and already-analyzed documents', () => {
    const pending = transitionDocumentChunkingWorkflow('document_received', {
      type: 'VALIDATION_SUCCEEDED',
      supportedForAnalysis: true,
      validationReason: 'supported_document_type',
    });

    expect(pending.value).toBe('validation_pending');
    expect(pending.context.supportedForAnalysis).toBe(true);
    expect(pending.context.validationReason).toBe('supported_document_type');

    const alreadyAnalyzed = transitionDocumentChunkingWorkflow('validation_pending', {
      type: 'ALREADY_ANALYZED',
    });

    expect(alreadyAnalyzed.value).toBe('completed');
    expect(alreadyAnalyzed.context.isAlreadyAnalyzed).toBe(true);
    expect(alreadyAnalyzed.context.validationReason).toBe('already_analyzed');
  });

  it('marks unsupported documents as failed with validation metadata', () => {
    const rejected = transitionDocumentChunkingWorkflow('validation_pending', {
      type: 'FAILED',
      error: 'unsupported_file_type',
    });

    expect(rejected.value).toBe('failed');
    expect(rejected.context.supportedForAnalysis).toBe(false);
    expect(rejected.context.validationReason).toBe('unsupported_file_type');
  });

  it('chunks extracted text with LangChain splitter metadata and stable ordering', async () => {
    const service = new DefaultDocumentChunkingService();
    const text = [
      'Project kickoff is scheduled for Monday morning.',
      'The budget review will confirm the procurement timeline.',
      'The pilot team will review the scope, assumptions, and risks before sign-off.',
      'Field crews need the revised safety checklist before work begins on site.',
      'Design approval is required before procurement can proceed on the updated package.',
      'The quality plan highlights the checklist for inspections, approvals, and closeout tasks.',
      'The project manager will share the current change log after the weekly review meeting.',
      'The subcontractor briefing references a revised schedule and updated milestones for the next phase.',
      'The client asked for weekly progress updates and explicit risk tracking across all workstreams.',
      'The team must validate the final scope before invoices are released for the next payment cycle.',
    ].join(' ');

    const chunks = await service.chunkDocument({
      documentId: 'doc-456',
      documentVersion: 3,
      projectId: 'project-123',
      rawText: text,
      config: {
        targetMinWords: 25,
        targetMaxWords: 40,
        hardMaxWords: 80,
        mergeThresholdWords: 12,
        preferBoundary: ['paragraph', 'sentence', 'word'],
      },
      pageMetadata: [
        { pageNumber: 1, text, startOffset: 0, endOffset: text.length },
      ],
    });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].documentId).toBe('doc-456');
    expect(chunks[0].documentVersion).toBe(3);
    expect(chunks[0].chunkIndex).toBe(0);
    expect(chunks.every(chunk => chunk.content.trim().length > 0)).toBe(true);
    expect(chunks.every(chunk => chunk.wordCount !== undefined && chunk.wordCount > 0)).toBe(true);
    expect(chunks.map(chunk => chunk.chunkIndex)).toEqual([...chunks.keys()]);
  });

  it('persists workflow checkpoint state and resumes by document version', async () => {
    await initDatabase();

    const repo = new DrizzleDocumentChunkingWorkflowRepository();
    const record = {
      id: 'checkpoint-doc-456-v3',
      documentId: 'doc-456',
      documentVersion: 3,
      projectId: 'project-123',
      status: 'validation_pending',
      workflowState: 'validation_pending',
      checkpointId: 'checkpoint-doc-456-v3',
      lastEvent: 'VALIDATION_SUCCEEDED',
      retryCount: 0,
      circuitOpen: false,
      supportedForAnalysis: true,
      validationReason: 'supported_document_type',
      isAlreadyAnalyzed: false,
      resumeFromCheckpoint: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await repo.upsert(record);

    const saved = await repo.findByDocumentVersion('doc-456', 3);
    expect(saved).not.toBeNull();
    expect(saved?.status).toBe('validation_pending');
    expect(saved?.supportedForAnalysis).toBe(true);
    expect(saved?.checkpointId).toBe('checkpoint-doc-456-v3');

    const resumed = await repo.findLatestByDocumentId('doc-456');
    expect(resumed?.documentVersion).toBe(3);
    expect(resumed?.resumeFromCheckpoint).toBe(true);
  });
});
