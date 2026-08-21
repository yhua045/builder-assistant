import { DefaultDocumentChunkingService } from './DefaultDocumentChunkingService';
import type { KnowledgeChunk } from '../../domain/entities/KnowledgeChunk';
import type { ParsedDocumentElement } from '../../../../shared/domain/services/DocumentParser';
import type {
  ChunkingConfig,
  ChunkingContext,
  DocumentChunkingStrategy,
} from '../../domain/services/DocumentChunkingStrategy';

export class StructuredDocumentChunkingStrategy implements DocumentChunkingStrategy {
  constructor(private readonly textStrategy = new DefaultDocumentChunkingService()) {}

  async chunkDocument(context: ChunkingContext): Promise<KnowledgeChunk[]> {
    const elements = context.elements?.filter(element => this.hasMeaningfulContent(element)) ?? [];
    if (elements.length === 0) {
      return this.textStrategy.chunkDocument(context);
    }

    const groups = this.groupByHeading(elements);
    const chunks: KnowledgeChunk[] = [];
    for (const group of groups) {
      const heading = group.heading;
        const headingWords = this.wordCount(heading ?? '');
      const bodyText = group.elements.map(element => this.renderElement(element)).filter(Boolean).join('\n\n');
      if (!bodyText) continue;

      const bodyLimit = Math.max(1, context.config.hardMaxWords - headingWords - 1);
      const groupConfig: ChunkingConfig = {
        ...context.config,
        targetMaxWords: Math.max(1, Math.min(context.config.targetMaxWords, bodyLimit)),
        hardMaxWords: bodyLimit,
      };
      const bodyChunks = await this.textStrategy.chunkDocument({
        ...context,
        rawText: bodyText,
        elements: undefined,
        config: groupConfig,
      });

      for (const bodyChunk of bodyChunks) {
        const prefix = heading ? `${heading}, ` : '';
        const content = `${prefix}${bodyChunk.content}`.trim();
        const metadata = {
          ...(bodyChunk.metadata ?? {}),
          heading: heading || undefined,
          sectionTitle: heading || undefined,
          elementTypes: [...new Set(group.elements.map(element => element.type))],
        };
        chunks.push({
          ...bodyChunk,
          id: `${context.documentId}-v${context.documentVersion}-chunk-${chunks.length}`,
          documentId: context.documentId,
          documentVersion: context.documentVersion,
          projectId: context.projectId,
          chunkIndex: chunks.length,
          content,
          wordCount: this.wordCount(content),
          tokenCount: this.wordCount(content),
          charCount: content.length,
          startOffset: undefined,
          endOffset: undefined,
          metadata,
        });
      }
    }

    return chunks;
  }

  async chunkParagraphs(text: string, config: ChunkingConfig): Promise<KnowledgeChunk[]> {
    return this.textStrategy.chunkParagraphs(text, config);
  }

  private groupByHeading(elements: ParsedDocumentElement[]): Array<{ heading?: string; elements: ParsedDocumentElement[] }> {
    const groups: Array<{ heading?: string; elements: ParsedDocumentElement[] }> = [];
    let current: { heading?: string; elements: ParsedDocumentElement[] } = { elements: [] };

    for (const element of elements) {
      if (element.type === 'heading') {
        if (current.elements.length > 0) groups.push(current);
        current = { heading: this.normalize(element.text), elements: [] };
        continue;
      }
      current.elements.push(element);
    }
    if (current.elements.length > 0) groups.push(current);
    return groups;
  }

  private renderElement(element: ParsedDocumentElement): string {
    switch (element.type) {
      case 'paragraph':
        return this.normalize(element.text);
      case 'list':
        return element.items
          .filter(item => this.normalize(item.text))
          .map((item, index) => `${element.ordered || item.ordered ? `${index + 1}.` : '-'} ${'  '.repeat(item.level ?? 0)}${this.normalize(item.text)}`)
          .join('\n');
      case 'table': {
        const caption = element.caption ? `Table: ${this.normalize(element.caption)}` : 'Table';
        const headers = element.headers?.length ? element.headers.join(' | ') : '';
        const rows = element.rows.map(row => row.join(' | ')).join('\n');
        return [caption, headers, rows].filter(Boolean).join('\n');
      }
      case 'figure':
        return [
          element.caption ? `Figure: ${this.normalize(element.caption)}` : 'Figure',
          element.altText ? `Alt text: ${this.normalize(element.altText)}` : '',
          element.extractedText ? `Extracted text: ${this.normalize(element.extractedText)}` : '',
        ].filter(Boolean).join('\n');
      case 'heading':
        return '';
    }
  }

  private hasMeaningfulContent(element: ParsedDocumentElement): boolean {
    return this.renderElement(element).trim().length > 0 || (element.type === 'heading' && this.normalize(element.text).length > 0);
  }

  private normalize(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
  }

  private wordCount(value: string): number {
    return value.split(/\s+/).filter(Boolean).length;
  }
}
