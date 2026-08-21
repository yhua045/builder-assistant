import { ExtractParsedDocumentUseCase } from '../../src/features/knowledge-embedding/application/usecases/ExtractParsedDocumentUseCase';
import type { ExtractedDocumentTextRepository } from '../../src/features/knowledge-embedding/domain/repositories/ExtractedDocumentTextRepository';
import type { ExtractedDocumentText } from '../../src/features/knowledge-embedding/domain/entities/ExtractedDocumentText';
import { ParseDocumentUseCase } from '../../src/features/knowledge-embedding/application/usecases/ParseDocumentUseCase';
import type { ParsedDocumentElement } from '../../src/shared/domain/services/DocumentParser';

const extractedText: ExtractedDocumentText = {
  id: 'extraction-1',
  documentId: 'doc-1',
  documentVersion: 1,
  text: 'Persisted text',
  pageMetadata: [],
  createdAt: new Date(),
};

describe('ExtractParsedDocumentUseCase', () => {
  it('passes through an extracted artifact already present in pipeline context', async () => {
    const repository: ExtractedDocumentTextRepository = {
      save: jest.fn(),
      findByDocumentVersion: jest.fn(),
    };
    const context = {
      documentId: 'doc-1',
      documentVersion: 1,
      extractedDocumentText: extractedText,
      marker: 'keep-me',
    };

    const result = await new ExtractParsedDocumentUseCase(repository).execute(context);

    expect(result).toBe(context);
    expect(repository.findByDocumentVersion).not.toHaveBeenCalled();
  });

  it('retrieves the artifact when pipeline context does not contain it', async () => {
    const repository: ExtractedDocumentTextRepository = {
      save: jest.fn(),
      findByDocumentVersion: jest.fn().mockResolvedValue(extractedText),
    };

    const result = await new ExtractParsedDocumentUseCase(repository).execute({
      documentId: 'doc-1',
      documentVersion: 1,
    });

    expect(result.extractedDocumentText).toBe(extractedText);
    expect(repository.findByDocumentVersion).toHaveBeenCalledWith('doc-1', 1);
  });
});

describe('ParseDocumentUseCase extraction persistence', () => {
  it('persists the normalized parser result as the versioned extraction artifact', async () => {
    const repository: ExtractedDocumentTextRepository = {
      save: jest.fn(),
      findByDocumentVersion: jest.fn(),
    };
    const parsed = {
      documentId: 'doc-2',
      documentVersion: 3,
      text: 'Parsed content',
      pageMetadata: [],
      createdAt: new Date(),
    };
    const parserRegistry = { parse: jest.fn().mockResolvedValue(parsed) };

    await new ParseDocumentUseCase(parserRegistry as never, repository).execute({
      documentId: 'doc-2',
      documentVersion: 3,
      sourceType: 'text',
    });

    expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({
      id: 'doc-2-v3-extracted',
      documentId: 'doc-2',
      documentVersion: 3,
      text: 'Parsed content',
    }));
  });

  it('passes parser structural elements into the extraction artifact', async () => {
    const repository: ExtractedDocumentTextRepository = {
      save: jest.fn(),
      findByDocumentVersion: jest.fn(),
    };
    const elements: ParsedDocumentElement[] = [{ type: 'heading', text: 'Engineering Plan' }];
    const parserRegistry = {
      parse: jest.fn().mockResolvedValue({
        documentId: 'doc-3',
        documentVersion: 1,
        text: '45x45 mm steel post.',
        pageMetadata: [],
        elements,
        createdAt: new Date(),
      }),
    };

    await new ParseDocumentUseCase(parserRegistry as never, repository).execute({
      documentId: 'doc-3',
      documentVersion: 1,
      sourceType: 'text',
    });

    expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({ elements }));
  });
});