import type { ExtractedDocumentText } from '../../domain/entities/ExtractedDocumentText';
import type { ExtractedDocumentTextRepository } from '../../domain/repositories/ExtractedDocumentTextRepository';

export interface ExtractParsedDocumentContext {
  documentId: string;
  documentVersion: number;
  extractedDocumentText?: ExtractedDocumentText;
  [key: string]: unknown;
}

export class ExtractParsedDocumentUseCase {
  constructor(private readonly repository: ExtractedDocumentTextRepository) {}

  async execute<T extends ExtractParsedDocumentContext>(
    context: T,
  ): Promise<T & { extractedDocumentText: ExtractedDocumentText }> {
    const current = context.extractedDocumentText;
    if (
      current &&
      current.documentId === context.documentId &&
      current.documentVersion === context.documentVersion &&
      current.text.trim().length > 0
    ) {
      return context as T & { extractedDocumentText: ExtractedDocumentText };
    }

    const extracted = await this.repository.findByDocumentVersion(
      context.documentId,
      context.documentVersion,
    );
    if (!extracted) {
      throw new Error('Extracted document text is not available');
    }

    return { ...context, extractedDocumentText: extracted };
  }
}