import { IOcrAdapter } from '../../../application/services/IOcrAdapter';
import { IReceiptParsingStrategy } from './IReceiptParsingStrategy';
import { NormalizedReceipt } from './IReceiptNormalizer';
import { IPdfConverter } from '../../../infrastructure/files/IPdfConverter';
import { IOcrDocumentService, OcrDocumentService } from '../../../application/services/IOcrDocumentService';
import { validatePdfFile } from '../../../utils/fileValidation';
import { IReceiptVisionParsingStrategy } from './IReceiptVisionParsingStrategy';

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
 * Orchestrates the end-to-end pipeline after a receipt file has been selected:
 *   1. (PDF only) Convert PDF pages to images via IPdfConverter
 *   2. OCR → extract raw text from the image(s)
 *   3. parse → strategy parses OcrResult into NormalizedReceipt
 *   4. Return normalized result + raw OCR text
 *
 * Mirrors ProcessQuotationUploadUseCase exactly.
 */
export class ProcessReceiptUploadUseCase {
  constructor(
    private readonly ocrAdapter: IOcrAdapter,
    private readonly parsingStrategy: IReceiptParsingStrategy,
    private readonly pdfConverter?: IPdfConverter,
    private readonly ocrDocumentService: IOcrDocumentService = new OcrDocumentService(ocrAdapter),
    private readonly visionStrategy?: IReceiptVisionParsingStrategy,
  ) {}

  async execute(
    input: ProcessReceiptUploadInput,
  ): Promise<ProcessReceiptUploadOutput> {
    const { fileUri, mimeType, fileSize } = input;

    // 1. Cross-cutting file validation
    const validation = validatePdfFile(mimeType, fileSize);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.error || 'Invalid file'}`);
    }

    // ── PDF path ─────────────────────────────────────────────────────────────
    if (mimeType === 'application/pdf') {
      // Vision PDF path: convert → take page 1 → send to vision model
      if (this.visionStrategy && this.pdfConverter) {
        try {
          return await this.processPdfVision(fileUri);
        } catch (err: any) {
          throw new Error(
            `Receipt processing failed: ${err?.message ?? 'Unknown error'}`,
          );
        }
      }

      if (!this.pdfConverter) {
        return {
          normalized: emptyNormalizedReceipt(),
          rawOcrText: '',
        };
      }

      try {
        return await this.processPdf(fileUri);
      } catch (err: any) {
        throw new Error(
          `Receipt processing failed: ${err?.message ?? 'Unknown error'}`,
        );
      }
    }

    // ── Image path ───────────────────────────────────────────────────────────

    // Vision path (skip OCR)
    if (this.visionStrategy) {
      try {
        const normalized = await this.visionStrategy.parse(fileUri);
        return { normalized, rawOcrText: '' };
      } catch (err: any) {
        throw new Error(
          `Receipt processing failed: ${err?.message ?? 'Unknown error'}`,
        );
      }
    }

    // Text OCR path
    try {
      const ocrResult = await this.ocrAdapter.extractText(fileUri);
      const rawOcrText = ocrResult.fullText;
      const normalized = await this.parsingStrategy.parse(ocrResult);
      return { normalized, rawOcrText };
    } catch (err: any) {
      throw new Error(
        `Receipt processing failed: ${err?.message ?? 'Unknown error'}`,
      );
    }
  }

  private async processPdfVision(pdfUri: string): Promise<ProcessReceiptUploadOutput> {
    const pages = await this.pdfConverter!.convertToImages(pdfUri);
    if (pages.length === 0) {
      return { normalized: emptyNormalizedReceipt(), rawOcrText: '' };
    }
    const firstPageUri = pages[0].uri;
    const normalized = await this.visionStrategy!.parse(firstPageUri);
    return { normalized, rawOcrText: '' };
  }

  private async processPdf(pdfUri: string): Promise<ProcessReceiptUploadOutput> {
    const pages = await this.pdfConverter!.convertToImages(pdfUri);

    if (pages.length === 0) {
      return {
        normalized: emptyNormalizedReceipt(),
        rawOcrText: '',
      };
    }

    const pageImageUris = pages.map((page) => page.uri);
    const documentOcrResult = await this.ocrDocumentService.extractFromPages(pageImageUris);
    const rawOcrText = documentOcrResult.rawText;
    const normalized = await this.parsingStrategy.parse(documentOcrResult.merged);

    return { normalized, rawOcrText };
  }
}

function emptyNormalizedReceipt(): NormalizedReceipt {
  return {
    vendor: null,
    date: null,
    total: null,
    subtotal: null,
    tax: null,
    currency: 'AUD',
    paymentMethod: null,
    receiptNumber: null,
    lineItems: [],
    notes: null,
    confidence: {
      overall: 0,
      vendor: 0,
      date: 0,
      total: 0,
    },
    suggestedCorrections: [],
  };
}
