import type { ExtractedDocumentText } from '../entities/ExtractedDocumentText';

export interface ExtractedDocumentTextRepository {
  save(extractedText: ExtractedDocumentText): Promise<void>;
  findByDocumentVersion(documentId: string, version: number): Promise<ExtractedDocumentText | null>;
}