import type { ExtractedDocumentTextRepository } from '../../domain/repositories/ExtractedDocumentTextRepository';
import {
  type DocumentParseInput,
  type ParsedDocumentText,
  ParseWorkflowState,
  type ParserRegistry,
} from '../services/DocumentParserService';

export interface ParseDocumentUseCaseContract {
  currentState: ParseWorkflowState;
  execute(input: DocumentParseInput): Promise<ParsedDocumentText>;
}

export class ParseDocumentUseCase implements ParseDocumentUseCaseContract {
  currentState: ParseWorkflowState = ParseWorkflowState.Received;

  constructor(
    private readonly parserRegistry: ParserRegistry,
    private readonly repository?: ExtractedDocumentTextRepository,
  ) {}

  private async persistExtractedDocument(input: DocumentParseInput, parsed: ParsedDocumentText): Promise<void> {
    if (!this.repository) {
      return;
    }

    await this.repository.save({
      id: `${input.documentId}-v${input.documentVersion}-extracted`,
      documentId: parsed.documentId,
      documentVersion: parsed.documentVersion,
      projectId: parsed.projectId,
      text: parsed.text,
      pageMetadata: parsed.pageMetadata ?? [],
      sectionHints: parsed.sectionHints ?? [],
      elements: parsed.elements ?? [],
      language: parsed.language ?? undefined,
      warnings: parsed.warnings ?? [],
      createdAt: parsed.createdAt ?? new Date(),
      updatedAt: new Date(),
    });
  }

  async execute(input: DocumentParseInput): Promise<ParsedDocumentText> {
    if (!input?.documentId?.trim()) {
      this.currentState = ParseWorkflowState.ParseFailed;
      throw new Error('Document id is required');
    }

    if (input.documentVersion < 1) {
      this.currentState = ParseWorkflowState.ParseFailed;
      throw new Error('Document version must be at least 1');
    }

    this.currentState = ParseWorkflowState.Validated;

    try {
      const result = await this.parserRegistry.parse(input);

      if (!result.text || result.text.trim().length === 0) {
        throw new Error('PDF parsing produced no text content');
      }

      await this.persistExtractedDocument(input, result);

      this.currentState = ParseWorkflowState.ParseSuccess;
      return result;
    } catch (error) {
      this.currentState = ParseWorkflowState.ParseFailed;

      if (error instanceof Error) {
        throw error;
      }

      throw new Error('PDF parsing failed');
    }
  }
}
