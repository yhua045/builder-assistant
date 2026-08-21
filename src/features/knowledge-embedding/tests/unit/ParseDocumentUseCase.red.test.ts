import {
  ParseWorkflowState,
  type DocumentParseInput,
} from '../../application/services/DocumentParserService';
import { ParseDocumentUseCase, type ParseDocumentUseCaseContract } from '../../application/usecases/ParseDocumentUseCase';
import { PdfTextParser } from '../../infrastructure/parsers/PdfTextParser';
import { ParserRegistry } from '../../../../shared/application/services/DocumentParserService';

describe('ParseDocumentUseCase red tests', () => {
  const makeRegistry = () => ParserRegistry.createDefault([new PdfTextParser()]);

  it('rejects a document with a missing document id before parsing starts', async () => {
    const useCase: ParseDocumentUseCaseContract = new ParseDocumentUseCase(makeRegistry());

    const input: DocumentParseInput = {
      documentId: '',
      documentVersion: 1,
      sourceType: 'pdf',
      rawText: 'Sample PDF extract',
    };

    await expect(useCase.execute(input)).rejects.toThrow('Document id is required');
  });

  it('accepts a valid PDF parse result even when page metadata is unavailable', async () => {
    const useCase: ParseDocumentUseCaseContract = new ParseDocumentUseCase(makeRegistry());

    const input: DocumentParseInput = {
      documentId: 'doc-123',
      documentVersion: 1,
      projectId: 'project-1',
      sourceType: 'pdf',
      rawText: 'This is parseable PDF text.',
    };

    await expect(useCase.execute(input)).resolves.toMatchObject({
      documentId: 'doc-123',
      documentVersion: 1,
      text: 'This is parseable PDF text.',
      pageMetadata: [],
      sectionHints: [],
    });
  });

  it('records a parse success state when extraction succeeds with available section hints', async () => {
    const useCase: ParseDocumentUseCaseContract = new ParseDocumentUseCase(makeRegistry());

    const input: DocumentParseInput = {
      documentId: 'doc-456',
      documentVersion: 2,
      sourceType: 'pdf',
      rawText: 'Introduction\n\nRequirements\n\nTimeline',
    };

    const result = await useCase.execute(input);

    expect(result.sectionHints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ heading: 'Introduction' }),
      ]),
    );
    expect(useCase.currentState).toBe(ParseWorkflowState.ParseSuccess);
  });

  it('routes format failures through the orchestrator instead of silently returning empty data', async () => {
    const useCase: ParseDocumentUseCaseContract = new ParseDocumentUseCase(makeRegistry());

    const input: DocumentParseInput = {
      documentId: 'doc-789',
      documentVersion: 1,
      sourceType: 'pdf',
      rawText: '',
    };

    await expect(useCase.execute(input)).rejects.toThrow('PDF parsing produced no text content');
    expect(useCase.currentState).toBe(ParseWorkflowState.ParseFailed);
  });

  it('resolves the PDF parser from the existing registry factory for valid source types', () => {
    const registry = makeRegistry();
    const parser = registry.selectParser({
      documentId: 'doc-1',
      documentVersion: 1,
      sourceType: 'pdf',
      rawText: 'valid',
    });

    expect(parser).toBeInstanceOf(PdfTextParser);
  });
});
