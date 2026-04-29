import { IFileSystemAdapter } from '../../../infrastructure/files/IFileSystemAdapter';
import { validatePdfFile } from '../../../utils/fileValidation';
import { NormalizedInvoice } from './IInvoiceNormalizer';
import { IInvoiceDocumentProcessor } from './IInvoiceDocumentProcessor';

export interface ProcessInvoiceUploadInput {
  /** Original URI of the selected file — copying is handled internally by this use case. */
  fileUri: string;
  filename: string;
  mimeType: string;
  fileSize: number;
}

export interface DocumentRef {
  localPath: string;
  filename: string;
  size: number;
  mimeType: string;
}

export interface ProcessInvoiceUploadOutput {
  normalized: NormalizedInvoice;
  documentRef: DocumentRef;
  /** Raw OCR text, preserved for storage in Document.metadata */
  rawOcrText: string;
}

/**
 * ProcessInvoiceUploadUseCase
 *
 * Orchestrates the end-to-end pipeline after a file has been selected:
 *   1. Validation: Ensures the file passes cross-cutting PDF/image validation rules
 *   2. File IO: Copies the file to app private storage
 *   3. Delegates all OCR / vision processing to the injected processor
 *   4. Returns normalized result + a DocumentRef ready for atomic save
 */
export class ProcessInvoiceUploadUseCase {
  constructor(
    private readonly fileSystemAdapter: IFileSystemAdapter,
    private readonly processor: IInvoiceDocumentProcessor,
  ) {}

  async execute(input: ProcessInvoiceUploadInput): Promise<ProcessInvoiceUploadOutput> {
    const { fileUri, filename, mimeType, fileSize } = input;

    // 1. Validate
    const validation = validatePdfFile(mimeType, fileSize);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.error ?? 'Invalid file'}`);
    }

    // 2. Copy to app-private storage
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).slice(2, 8);
    const destFilename = `invoice_${timestamp}_${randomSuffix}.pdf`;
    const localUri = await this.fileSystemAdapter.copyToAppStorage(fileUri, destFilename);

    const documentRef: DocumentRef = { localPath: localUri, filename, size: fileSize, mimeType };

    // 3. Delegate all processing
    const { normalized, rawOcrText } = await this.processor.process(localUri, mimeType);

    return { normalized, documentRef, rawOcrText };
  }
}
