import { KnowledgeChunk } from '../entities/KnowledgeChunk.ts';
import type { ParsedDocumentElement } from '../../../../shared/domain/services/DocumentParser';

export type ChunkBoundary = 'page' | 'section' | 'paragraph' | 'sentence' | 'word';

export interface ChunkingConfig {
  targetMinWords: number;
  targetMaxWords: number;
  hardMaxWords: number;
  mergeThresholdWords: number;
  preferBoundary: ChunkBoundary[];
  chunkOverlapWords?: number;
}

export interface ChunkingPageMetadata {
  pageNumber: number;
  text: string;
  startOffset?: number;
  endOffset?: number;
}

export interface ChunkingSectionHint {
  heading: string;
  text: string;
}

export interface ChunkingContext {
  documentId: string;
  documentVersion: number;
  projectId?: string;
  rawText: string;
  pageMetadata?: ChunkingPageMetadata[];
  sectionHints?: ChunkingSectionHint[];
  elements?: ParsedDocumentElement[];
  config: ChunkingConfig;
}

export interface DocumentChunkingStrategy {
  chunkDocument(context: ChunkingContext): Promise<KnowledgeChunk[]>;
  chunkParagraphs(text: string, config: ChunkingConfig): Promise<KnowledgeChunk[]>;
}
