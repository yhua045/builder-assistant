import { IFileSystemAdapter } from '../../../infrastructure/files/IFileSystemAdapter';
import { validatePdfFile } from '../../../utils/fileValidation';
import { NormalizedQuotation } from './ai/IQuotationParsingStrategy';
import { IQuotationDocumentProcessor } from './IQuotationDocumentProcessor';

export interface ProcessQuotationUploadInput {
  /** The original URI from the file picker */
  fileUri: string;
  filename: string;
  mimeType: string;
  fileSize: number;
}

export interface QuotationDocumentRef {
  localPath: string;
  filename: string;
  size: number;
  mimeType: string;
}

export interface ProcessQuotationUploadOutput {
  normalized: NormalizedQuotation;
  documentRef: QuotationDocumentRef;
  /** Raw OCR text, preserved for storage in Document.metadata */
  rawOcrText: string;
}

/**
 * ProcessQuotationUploadUseCase
 *
 * Orchestrates the end-to-end pipeline after a file has been selected:
 *   1. Validation: Ensures the file passes cross-cutting PDF validation rules
 *   2. File IO: Copies the file to app private storage
 *   3. Delegates all OCR / vision processing to the injected processor
 *   4. Returns normalized result + a QuotationDocumentRef ready for atomic save
 */
export class ProcessQuotationUploadUseCase {
  constructor(
    private readonly fileSystemAdapter: IFileSystemAdapter,
    private readonly processor: IQuotationDocumentProcessor,
  ) {}

  async execute(input: ProcessQuotationUploadInput): Promise<ProcessQuotationUploadOutput> {
    const { fileUri, filename, mimeType, fileSize } = input;

    // 1. Validate
    const validation = validatePdfFile(mimeType, fileSize);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.error ?? 'Invalid file'}`);
    }

    // 2. Copy to app-private storage
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).slice(2, 8);
    const destFilename = `quote_${timestamp}_${randomSuffix}.pdf`;
    const localPath = await this.fileSystemAdapter.copyToAppStorage(fileUri, destFilename);

    const documentRef: QuotationDocumentRef = { localPath, filename, size: fileSize, mimeType };

    // 3. Delegate all processing
    const { normalized, rawOcrText } = await this.processor.process(localPath, mimeType);

    return { normalized, documentRef, rawOcrText };
  }
}
