import {
  DocumentParseInput,
  ParsedDocumentText,
} from '../../../../shared/domain/services/DocumentParser';
import { ParserRegistry } from '../../../../shared/application/services/DocumentParserService';
import type { ExtractedDocumentTextRepository } from '../../domain/repositories/ExtractedDocumentTextRepository';

export class ParseDocumentUseCase {
  constructor(
    private readonly parserRegistry: ParserRegistry,
    private readonly extractedTextRepository?: ExtractedDocumentTextRepository,
  ) {}

  async execute(input: DocumentParseInput): Promise<ParsedDocumentText> {
    if (!input.documentId || !input.documentId.trim()) {
      throw new Error('Document id is required');
    }

    if (input.documentVersion < 1) {
      throw new Error('Document version must be >= 1');
    }

    const parsed = await this.parserRegistry.parse(input);
    if (this.extractedTextRepository) {
      await this.extractedTextRepository.save({
        id: `${parsed.documentId}-v${parsed.documentVersion}-extracted`,
        documentId: parsed.documentId,
        documentVersion: parsed.documentVersion,
        projectId: parsed.projectId,
        text: parsed.text,
        pageMetadata: parsed.pageMetadata,
        sectionHints: parsed.sectionHints,
        language: parsed.language,
        warnings: parsed.warnings,
        createdAt: parsed.createdAt,
        updatedAt: new Date(),
      });
    }
    return parsed;
  }
}
