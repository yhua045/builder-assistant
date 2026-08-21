import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { KnowledgeChunk } from '../../domain/entities/KnowledgeChunk';
import {
  ChunkingConfig,
  ChunkingContext,
  DocumentChunkingStrategy,
} from '../../domain/services/DocumentChunkingStrategy';

export class DefaultDocumentChunkingService implements DocumentChunkingStrategy {
  static readonly DEFAULT_CONFIG: ChunkingConfig = {
    targetMinWords: 80,
    targetMaxWords: 600,
    hardMaxWords: 900,
    mergeThresholdWords: 40,
    preferBoundary: ['page', 'section', 'paragraph', 'sentence', 'word'],
    chunkOverlapWords: 40,
  };

  private mergeConfig(config: Partial<ChunkingConfig> = {}): ChunkingConfig {
    return {
      ...DefaultDocumentChunkingService.DEFAULT_CONFIG,
      ...config,
      preferBoundary: config.preferBoundary ?? DefaultDocumentChunkingService.DEFAULT_CONFIG.preferBoundary,
      chunkOverlapWords:
        config.chunkOverlapWords ??
        DefaultDocumentChunkingService.DEFAULT_CONFIG.chunkOverlapWords ??
        Math.max(10, Math.floor((config.targetMaxWords ?? DefaultDocumentChunkingService.DEFAULT_CONFIG.targetMaxWords) * 0.15)),
    };
  }

  private normalizeText(value: string): string {
    return value
      .replace(/\r\n/g, '\n')
      .replace(/\u00A0/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]*\n[ \t]*/g, '\n')
      .trim();
  }

  private getChunkOverlapWords(config: ChunkingConfig): number {
    const overlap = config.chunkOverlapWords ?? Math.max(10, Math.floor(config.targetMaxWords * 0.15));
    return Math.min(Math.max(0, overlap), Math.max(0, config.targetMaxWords - 1));
  }

  private buildLangChainSplitter(config: ChunkingConfig): RecursiveCharacterTextSplitter {
    const chunkSize = Math.max(1, config.targetMaxWords);
    const overlap = this.getChunkOverlapWords(config);

    if (overlap >= chunkSize) {
      return new RecursiveCharacterTextSplitter({
        chunkSize,
        chunkOverlap: Math.max(0, chunkSize - 1),
        separators: ['\n\n', '\n', '. ', ' ', ''],
        lengthFunction: (segment: string) => segment.trim().split(/\s+/).filter(Boolean).length,
      });
    }

    return new RecursiveCharacterTextSplitter({
      chunkSize,
      chunkOverlap: overlap,
      separators: ['\n\n', '\n', '. ', ' ', ''],
      lengthFunction: (segment: string) => segment.trim().split(/\s+/).filter(Boolean).length,
    });
  }

  private splitFallback(text: string, config: ChunkingConfig): string[] {
    const normalized = this.normalizeText(text);
    if (!normalized) return [];

    const tokens = normalized.split(/\s+/).filter(Boolean);
    const chunkSize = Math.max(1, config.targetMaxWords);
    const overlap = this.getChunkOverlapWords(config);
    const step = Math.max(1, chunkSize - overlap);
    const segments: string[] = [];

    for (let index = 0; index < tokens.length; index += step) {
      const slice = tokens.slice(index, index + chunkSize);
      if (slice.length === 0) break;
      const segment = slice.join(' ');
      segments.push(segment);

      if (slice.length < chunkSize) {
        break;
      }
    }

    return segments.filter(segment => segment.trim().length > 0);
  }

  private computeWordCount(value: string): number {
    return value.split(/\s+/).filter(Boolean).length;
  }

  private buildChunk(
    documentId: string,
    documentVersion: number,
    projectId: string | undefined,
    chunkIndex: number,
    content: string,
    normalizedText: string,
    pageNumber?: number,
  ): KnowledgeChunk {
    const trimmed = content.trim();
    const wordCount = this.computeWordCount(trimmed);
    const startOffset = normalizedText.indexOf(trimmed, 0);
    const endOffset = startOffset >= 0 ? startOffset + trimmed.length : normalizedText.length;

    return {
      id: `${documentId}-v${documentVersion}-chunk-${chunkIndex}`,
      documentId,
      documentVersion,
      projectId,
      content: trimmed,
      chunkIndex,
      wordCount,
      charCount: trimmed.length,
      tokenCount: wordCount,
      startOffset: startOffset >= 0 ? startOffset : undefined,
      endOffset: endOffset >= 0 ? endOffset : undefined,
      isOutdated: false,
      isSuperseded: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {
        pageNumber,
        boundary: 'paragraph',
      },
    };
  }

  public async chunkDocument(context: ChunkingContext): Promise<KnowledgeChunk[]> {
    const config = this.mergeConfig(context.config);
    const normalizedText = this.normalizeText(context.rawText ?? '');

    if (!normalizedText) {
      return [];
    }

    const splitter = this.buildLangChainSplitter(config);
    const normalisedText = await splitter
      .splitText(normalizedText);

    const segments = normalisedText
      .map((segment: string) => segment.trim())
      .filter((segment: string) => segment.length > 0);

    if (segments.length === 0) {
      return [];
    }

    const pageNumber = context.pageMetadata?.[0]?.pageNumber;
    return segments.map((segment, index) => this.buildChunk(
      context.documentId,
      context.documentVersion,
      context.projectId,
      index,
      segment,
      normalizedText,
      pageNumber,
    ));
  }

  public async chunkParagraphs(text: string, config: ChunkingConfig): Promise<KnowledgeChunk[]> {
    const normalizedConfig = this.mergeConfig(config);
    const normalizedText = this.normalizeText(text);
    if (!normalizedText) return [];

    const splitter = this.buildLangChainSplitter(normalizedConfig);
    const normalisedText = await splitter
      .splitText(normalizedText);

    const segments = normalisedText
      .map((segment: string) => segment.trim())
      .filter((segment: string) => segment.length > 0);

    return segments.map((segment, index) => this.buildChunk(
      'document-placeholder',
      1,
      undefined,
      index,
      segment,
      normalizedText,
      undefined,
    ));
  }
}
