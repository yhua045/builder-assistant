import type {
  DocumentParseInput,
  DocumentParser,
  ParsedDocumentText,
} from '../../application/services/DocumentParserService';

export class PdfTextParser implements DocumentParser {
  canHandle(input: DocumentParseInput): boolean {
    return input.sourceType === 'pdf';
  }

  async parse(input: DocumentParseInput): Promise<ParsedDocumentText> {
    if (!this.canHandle(input)) {
      throw new Error('PdfTextParser only supports PDF sourceType inputs');
    }

    const rawText = typeof input.rawText === 'string' ? input.rawText : input.binary ? new TextDecoder().decode(input.binary) : '';
    const normalizedText = rawText.replace(/\r\n/g, '\n').replace(/\u00A0/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').replace(/[ \t]*\n[ \t]*/g, '\n').trim();

    if (!normalizedText) {
      throw new Error('PDF parsing produced no text content');
    }

    const sections = normalizedText
      .split(/\n\s*\n+/)
      .map(section => section.trim())
      .filter(Boolean)
      .slice(0, 10);

    const sectionHints = sections.length > 1
      ? sections.map(section => {
          const heading = section.split(/\n/)[0].trim() || 'Section';
          return {
            heading,
            text: section,
          };
        })
      : [];

    return {
      documentId: input.documentId,
      documentVersion: input.documentVersion,
      projectId: input.projectId,
      text: normalizedText,
      pageMetadata: [],
      sectionHints,
      createdAt: new Date(),
    };
  }
}
