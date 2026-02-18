import { IOcrAdapter } from '../../services/IOcrAdapter';
import { IInvoiceNormalizer, NormalizedInvoice } from '../../ai/IInvoiceNormalizer';

export interface ProcessInvoiceUploadInput {
  /** App-private URI to the file (already copied by InvoiceScreen) */
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
 * Orchestrates the end-to-end pipeline after a file has been selected and
 * copied to app private storage:
 *   1. OCR → extract raw text from the image/file
 *   2. extractCandidates → convert raw text into structured field candidates
 *   3. normalize → apply business rules and return a NormalizedInvoice
 *   4. Return normalized result + a DocumentRef ready for atomic save
 *
 * For PDF files, the OCR step is skipped (ML Kit only handles images) and an
 * empty NormalizedInvoice is returned so the user can fill the form manually.
 */
export class ProcessInvoiceUploadUseCase {
  constructor(
    private readonly ocrAdapter: IOcrAdapter,
    private readonly normalizer: IInvoiceNormalizer,
  ) {}

  async execute(input: ProcessInvoiceUploadInput): Promise<ProcessInvoiceUploadOutput> {
    const { fileUri, filename, mimeType, fileSize } = input;

    const documentRef: DocumentRef = {
      localPath: fileUri,
      filename,
      size: fileSize,
      mimeType,
    };

    // PDF files cannot be processed by ML Kit OCR — return empty normalized data
    if (mimeType === 'application/pdf') {
      return {
        normalized: this.emptyNormalizedInvoice(),
        documentRef,
        rawOcrText: '',
      };
    }

    // Step 1: OCR
    let rawOcrText = '';
    try {
      const ocrResult = await this.ocrAdapter.extractText(fileUri);
      rawOcrText = ocrResult.fullText;

      // Step 2: Extract candidates from raw text
      const candidates = this.normalizer.extractCandidates(rawOcrText);

      // Step 3: Normalize candidates
      const normalized = await this.normalizer.normalize(candidates, ocrResult);

      return { normalized, documentRef, rawOcrText };
    } catch (err: any) {
      // Re-throw with a more descriptive message for the UI to handle
      throw new Error(
        `Invoice processing failed: ${err?.message ?? 'Unknown error'}`
      );
    }
  }

  private emptyNormalizedInvoice(): NormalizedInvoice {
    return {
      vendor: null,
      invoiceNumber: null,
      invoiceDate: null,
      dueDate: null,
      subtotal: null,
      tax: null,
      total: null,
      currency: 'USD',
      lineItems: [],
      confidence: {
        overall: 0,
        vendor: 0,
        invoiceNumber: 0,
        invoiceDate: 0,
        total: 0,
      },
      suggestedCorrections: [
        'PDF text extraction is not yet supported — please fill in the details manually',
      ],
    };
  }
}
