import {
  DocumentParseInput,
  ParsedDocumentText,
} from '../../domain/services/DocumentParser';
import { ParserRegistry } from '../services/DocumentParserService';

export class ParseDocumentUseCase {
  constructor(private readonly parserRegistry: ParserRegistry) {}

  async execute(input: DocumentParseInput): Promise<ParsedDocumentText> {
    if (!input.documentId || !input.documentId.trim()) {
      throw new Error('Document id is required');
    }

    if (input.documentVersion < 1) {
      throw new Error('Document version must be >= 1');
    }

    return this.parserRegistry.parse(input);
  }
}
