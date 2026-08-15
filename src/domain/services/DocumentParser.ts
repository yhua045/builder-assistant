export type DocumentSourceType = 'pdf' | 'image' | 'text' | 'docx';

export interface DocumentParseInput {
  documentId: string;
  documentVersion: number;
  projectId?: string;
  sourceType: DocumentSourceType;
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

export interface ParsedDocumentText {
  documentId: string;
  documentVersion: number;
  projectId?: string;
  text: string;
  pageMetadata: ParsedDocumentPage[];
  sectionHints?: SectionHint[];
  language?: string;
  warnings?: string[];
  createdAt: Date;
}

export interface TextNormalizer {
  normalize(input: string): string;
}

export interface DocumentParser {
  canHandle(input: DocumentParseInput): boolean;
  parse(input: DocumentParseInput): Promise<ParsedDocumentText>;
}
