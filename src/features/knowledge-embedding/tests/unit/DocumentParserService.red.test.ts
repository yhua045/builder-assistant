import { DefaultDocumentParserService, type DocumentParseInput, ParseWorkflowState } from '../../application/services/DocumentParserService';
import { PdfTextParser } from '../../infrastructure/parsers/PdfTextParser';
import { ParserRegistry } from '../../../../shared/application/services/DocumentParserService';
import type { DocumentVersion } from '../../../../shared/domain/entities/DocumentVersion';

describe('DocumentParserService red tests', () => {
  const makeRegistry = () => ParserRegistry.createDefault([new PdfTextParser()]);

  const makeVersionRepository = () => ({
    getByDocumentId: jest.fn(),
    getLatestByDocumentId: jest.fn(),
    getById: jest.fn(),
    update: jest.fn(),
  });

  const makeExtractionRepository = () => ({
    findByDocumentVersion: jest.fn(),
    save: jest.fn(),
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns the stored result without re-running the parser when the same document version already exists', async () => {
    const parserRegistry = makeRegistry();
    const extractionRepository = makeExtractionRepository();
    const versionRepository = makeVersionRepository();

    extractionRepository.findByDocumentVersion.mockResolvedValue({
      id: 'extracted-1',
      documentId: 'doc-1',
      documentVersion: 1,
      text: 'stored text',
      pageMetadata: [],
      createdAt: new Date(),
    });

    const service = new DefaultDocumentParserService({
      parserRegistry,
      extractedDocumentTextRepository: extractionRepository,
      documentVersionRepository: versionRepository,
    });

    const input: DocumentParseInput = {
      documentId: 'doc-1',
      documentVersion: 1,
      sourceType: 'pdf',
      rawText: 'new parse text',
    };

    await expect(service.execute(input)).resolves.toMatchObject({
      documentId: 'doc-1',
      documentVersion: 1,
      text: 'stored text',
    });
    expect(extractionRepository.findByDocumentVersion).toHaveBeenCalledWith('doc-1', 1);
  });

  it('persists a failure state and retry metadata without creating a duplicate extracted row', async () => {
    const parserRegistry = makeRegistry();
    const extractionRepository = makeExtractionRepository();
    const versionRepository = makeVersionRepository();

    extractionRepository.findByDocumentVersion.mockResolvedValue(null);
    versionRepository.getByDocumentId.mockResolvedValue({
      id: 'version-1',
      documentId: 'doc-2',
      version: 1,
      status: 'received',
      workflowState: 'document_received',
      validationStatus: 'pending',
      retryCount: 0,
      createdAt: new Date(),
    } as DocumentVersion);

    const service = new DefaultDocumentParserService({
      parserRegistry,
      extractedDocumentTextRepository: extractionRepository,
      documentVersionRepository: versionRepository,
    });

    const input: DocumentParseInput = {
      documentId: 'doc-2',
      documentVersion: 1,
      sourceType: 'pdf',
      rawText: '',
    };

    await expect(service.execute(input)).rejects.toThrow('PDF parsing produced no text content');
    expect(versionRepository.update).toHaveBeenCalledWith(
      'version-1',
      expect.objectContaining({
        status: 'failed',
        workflowState: 'failed',
        lastError: expect.stringContaining('PDF parsing produced no text content'),
        retryCount: expect.any(Number),
      }),
    );
    expect(extractionRepository.save).not.toHaveBeenCalled();
  });

  it('returns the canonical workflow state for a successfully extracted document version', async () => {
    const parserRegistry = makeRegistry();
    const extractionRepository = makeExtractionRepository();
    const versionRepository = makeVersionRepository();

    extractionRepository.findByDocumentVersion.mockResolvedValue(null);
    versionRepository.getByDocumentId.mockResolvedValue({
      id: 'version-2',
      documentId: 'doc-3',
      version: 2,
      status: 'received',
      workflowState: 'document_received',
      validationStatus: 'pending',
      retryCount: 0,
      createdAt: new Date(),
    } as DocumentVersion);

    const service = new DefaultDocumentParserService({
      parserRegistry,
      extractedDocumentTextRepository: extractionRepository,
      documentVersionRepository: versionRepository,
    });

    const input: DocumentParseInput = {
      documentId: 'doc-3',
      documentVersion: 2,
      sourceType: 'pdf',
      rawText: 'Introduce the revised requirements',
    };

    const result = await service.execute(input);

    expect(result).toMatchObject({
      documentId: 'doc-3',
      documentVersion: 2,
      text: 'Introduce the revised requirements',
    });
    expect(versionRepository.update).toHaveBeenCalledWith(
      'version-2',
      expect.objectContaining({
        status: 'extracted',
        workflowState: 'text_extracted',
        lastEvent: 'document_parsed',
      }),
    );
    expect(extractionRepository.save).toHaveBeenCalled();
  });

  it('keeps the parser stateless and leaves persistence to the orchestration service boundary', async () => {
    const parserRegistry = makeRegistry();
    const service = new DefaultDocumentParserService({
      parserRegistry,
      extractedDocumentTextRepository: makeExtractionRepository(),
      documentVersionRepository: makeVersionRepository(),
    });

    const parser = parserRegistry.selectParser({
      documentId: 'doc-10',
      documentVersion: 1,
      sourceType: 'pdf',
      rawText: 'Some text',
    });

    expect(parser).toBeInstanceOf(PdfTextParser);
    expect(ParseWorkflowState.ParseSuccess).toBe('parse_success');
  });
});
