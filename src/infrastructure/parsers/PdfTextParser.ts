import {
  DocumentParseInput,
  DocumentParser,
  ParsedDocumentText,
} from '../../domain/services/DocumentParser';

export class PdfTextParser implements DocumentParser {
  canHandle(input: DocumentParseInput): boolean {
    return input.sourceType === 'pdf';
  }

  async parse(input: DocumentParseInput): Promise<ParsedDocumentText> {
    if (!this.canHandle(input)) {
      throw new Error('PdfTextParser only supports PDF sourceType inputs');
    }

    const text = this.extractPdfText(input.rawText ?? input.filePath ?? '');
    const trimmedText = text.trim();

    if (!trimmedText) {
      throw new Error('PDF parsing produced no text content');
    }

    const normalizedText = trimmedText.replace(/\r\n/g, '\n');

    return {
      documentId: input.documentId,
      documentVersion: input.documentVersion,
      projectId: input.projectId,
      text: normalizedText,
      pageMetadata: [
        {
          pageNumber: 1,
          text: normalizedText,
          startOffset: 0,
          endOffset: normalizedText.length,
        },
      ],
      warnings: [],
      createdAt: new Date(),
    };
  }

  private extractPdfText(raw: string): string {
    if (!raw) {
      return '';
    }

    const normalized = raw
      .replace(/\r\n/g, '\n')
      .replace(/\u0000/g, ' ')
      .replace(/\n{3,}/g, '\n\n');

    const cleaned = normalized
      .replace(/\s*\n\s*/g, '\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();

    return cleaned || raw.trim();
  }
}
