import { validatePdfFile } from '../../../utils/fileValidation';
import { NormalizedReceipt } from './IReceiptNormalizer';
import { IReceiptDocumentProcessor } from './IReceiptDocumentProcessor';

export interface ProcessReceiptUploadInput {
  fileUri: string;
  filename: string;
  mimeType: string;
  fileSize: number;
}

export interface ProcessReceiptUploadOutput {
  normalized: NormalizedReceipt;
  rawOcrText: string;
}

/**
 * ProcessReceiptUploadUseCase
 *
 * Validates the receipt file and delegates all processing to the injected processor.
 * Receipts are not copied to private storage (no fileSystemAdapter).
 */
export class ProcessReceiptUploadUseCase {
  constructor(
    private readonly processor: IReceiptDocumentProcessor,
  ) {}

  async execute(input: ProcessReceiptUploadInput): Promise<ProcessReceiptUploadOutput> {
    const { fileUri, mimeType, fileSize } = input;

    const validation = validatePdfFile(mimeType, fileSize);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.error ?? 'Invalid file'}`);
    }

    return this.processor.process(fileUri, mimeType);
  }
}
