import type { DocumentVersion } from '../../../../shared/domain/entities/DocumentVersion';
import type { ExtractedDocumentText } from '../../domain/entities/ExtractedDocumentText';

export enum ParseWorkflowState {
  Received = 'received',
  Validated = 'validated',
  ParseFailed = 'parse_failed',
  ParseSuccess = 'parse_success',
}

export enum ParseFailureReason {
  ValidationError = 'validation_error',
  FileError = 'file_error',
  FormatError = 'format_error',
  UnsupportedSource = 'unsupported_source',
}

export interface DocumentParseInput {
  documentId: string;
  documentVersion: number;
  projectId?: string;
  sourceType: 'pdf' | 'image' | 'text' | 'docx';
  contentType?: string;
  filePath?: string;
  rawText?: string;
  binary?: ArrayBuffer | Uint8Array;
  storageKey?: string;
  options?: {
    preservePages?: boolean;
    includePageBreaks?: boolean;
    normalizeWhitespace?: boolean;
  };
}

export interface ParsedDocumentPage {
  pageNumber: number;
  text: string;
  startOffset: number;
  endOffset: number;
}

export interface SectionHint {
  heading: string;
  text: string;
}

export type ParsedDocumentElement =
  | { type: 'heading'; text: string; level?: number; pageNumber?: number }
  | { type: 'paragraph'; text: string; pageNumber?: number }
  | {
      type: 'list';
      items: Array<{ text: string; level?: number; ordered?: boolean }>;
      pageNumber?: number;
      ordered?: boolean;
    }
  | {
      type: 'table';
      caption?: string;
      headers?: string[];
      rows: string[][];
      pageNumber?: number;
    }
  | {
      type: 'figure';
      caption?: string;
      altText?: string;
      extractedText?: string;
      pageNumber?: number;
    };

export interface ParsedDocumentText {
  documentId: string;
  documentVersion: number;
  projectId?: string;
  text: string;
  pageMetadata: ParsedDocumentPage[];
  sectionHints?: SectionHint[];
  elements?: ParsedDocumentElement[];
  language?: string;
  warnings?: string[];
  createdAt: Date;
}

export interface DocumentParser {
  canHandle(input: DocumentParseInput): boolean;
  parse(input: DocumentParseInput): Promise<ParsedDocumentText>;
}

export interface ParserRegistry {
  selectParser(input: DocumentParseInput): DocumentParser;
  parse(input: DocumentParseInput): Promise<ParsedDocumentText>;
}

export interface ParseDocumentUseCaseContract {
  currentState: ParseWorkflowState;
  execute(input: DocumentParseInput): Promise<ParsedDocumentText>;
}

export interface DocumentParserPersistenceGateway {
  findByDocumentVersion(documentId: string, version: number): Promise<ExtractedDocumentText | null>;
  save(extractedText: ExtractedDocumentText): Promise<void>;
}

export interface DocumentVersionPersistenceGateway {
  getByDocumentId(documentId: string): Promise<DocumentVersion | null>;
  getById(versionId: string): Promise<DocumentVersion | null>;
  update(versionId: string, patch: Partial<DocumentVersion>): Promise<DocumentVersion>;
}

export interface DocumentParserServiceContract {
  execute(input: DocumentParseInput): Promise<ParsedDocumentText>;
  getStoredResult(documentId: string, documentVersion: number): Promise<ParsedDocumentText | null>;
  persistFailure(input: DocumentParseInput, error: Error, version?: DocumentVersion): Promise<DocumentVersion>;
}

export interface DocumentParserServiceDependencies {
  parserRegistry: ParserRegistry;
  extractedDocumentTextRepository: DocumentParserPersistenceGateway;
  documentVersionRepository: DocumentVersionPersistenceGateway;
}

export class DefaultDocumentParserService implements DocumentParserServiceContract {
  constructor(private readonly dependencies: DocumentParserServiceDependencies) {}

  private async getVersionByDocumentId(documentId: string): Promise<DocumentVersion | null> {
    const repo = this.dependencies.documentVersionRepository as any;

    if (typeof repo.getByDocumentId === 'function') {
      return repo.getByDocumentId(documentId);
    }

    if (typeof repo.getLatestByDocumentId === 'function') {
      return repo.getLatestByDocumentId(documentId);
    }

    return null;
  }

  private async updateVersion(version: DocumentVersion | null, patch: Partial<DocumentVersion>): Promise<DocumentVersion | null> {
    if (!version) {
      return null;
    }

    const repo = this.dependencies.documentVersionRepository as any;
    if (typeof repo.update !== 'function') {
      return version;
    }

    return repo.update(version.id, patch);
  }

  private mapStoredResult(stored: any): ParsedDocumentText | null {
    if (!stored) {
      return null;
    }

    return {
      documentId: stored.documentId,
      documentVersion: stored.documentVersion,
      projectId: stored.projectId,
      text: stored.text,
      pageMetadata: Array.isArray(stored.pageMetadata) ? stored.pageMetadata : [],
      sectionHints: Array.isArray(stored.sectionHints) ? stored.sectionHints : [],
      elements: Array.isArray(stored.elements) ? stored.elements : [],
      language: stored.language ?? undefined,
      warnings: Array.isArray(stored.warnings) ? stored.warnings : [],
      createdAt: stored.createdAt ?? new Date(),
    };
  }

  private toExtractedDocumentText(input: DocumentParseInput, parsed: ParsedDocumentText): any {
    return {
      id: `${input.documentId}-v${input.documentVersion}-extracted`,
      documentId: input.documentId,
      documentVersion: input.documentVersion,
      projectId: input.projectId,
      text: parsed.text,
      pageMetadata: parsed.pageMetadata ?? [],
      sectionHints: parsed.sectionHints ?? [],
      elements: parsed.elements ?? [],
      language: parsed.language ?? undefined,
      warnings: parsed.warnings ?? [],
      createdAt: parsed.createdAt ?? new Date(),
      updatedAt: new Date(),
    };
  }

  async execute(input: DocumentParseInput): Promise<ParsedDocumentText> {
    if (!input?.documentId?.trim()) {
      throw new Error('Document id is required');
    }

    if (input.documentVersion < 1) {
      throw new Error('Document version must be at least 1');
    }

    const stored = await this.dependencies.extractedDocumentTextRepository.findByDocumentVersion(
      input.documentId,
      input.documentVersion,
    );

    if (stored) {
      return this.mapStoredResult(stored) ?? stored;
    }

    const version = await this.getVersionByDocumentId(input.documentId);

    if (version) {
      await this.updateVersion(version, {
        status: 'validated',
        workflowState: 'validation_pending',
        validationStatus: 'pending',
        lastEvent: 'validation_started',
        updatedAt: new Date(),
      });
    }

    try {
      const parsed = await this.dependencies.parserRegistry.parse(input);

      if (!parsed.text || parsed.text.trim().length === 0) {
        throw new Error('PDF parsing produced no text content');
      }

      const extractedText = this.toExtractedDocumentText(input, parsed);
      await this.dependencies.extractedDocumentTextRepository.save(extractedText);

      if (version) {
        await this.updateVersion(version, {
          status: 'extracted',
          workflowState: 'text_extracted',
          validationStatus: 'passed',
          lastEvent: 'document_parsed',
          updatedAt: new Date(),
          lastError: undefined,
        });
      }

      return parsed;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'PDF parsing failed';

      if (version) {
        const nextRetryCount = (version.retryCount ?? 0) + 1;
        await this.updateVersion(version, {
          status: 'failed',
          workflowState: 'failed',
          validationStatus: 'failed',
          lastError: message,
          retryCount: nextRetryCount,
          lastEvent: 'parse_failed',
          updatedAt: new Date(),
        });
      }

      throw error instanceof Error ? error : new Error(message);
    }
  }

  async getStoredResult(documentId: string, documentVersion: number): Promise<ParsedDocumentText | null> {
    const stored = await this.dependencies.extractedDocumentTextRepository.findByDocumentVersion(documentId, documentVersion);
    return this.mapStoredResult(stored);
  }

  async persistFailure(input: DocumentParseInput, error: Error, version?: DocumentVersion): Promise<DocumentVersion> {
    const current = version ?? (await this.getVersionByDocumentId(input.documentId));

    if (!current) {
      throw error;
    }

    const updated = await this.updateVersion(current, {
      status: 'failed',
      workflowState: 'failed',
      validationStatus: 'failed',
      lastError: error.message,
      retryCount: (current.retryCount ?? 0) + 1,
      lastEvent: 'parse_failed',
      updatedAt: new Date(),
    });

    return updated ?? current;
  }
}
