import { IOcrAdapter } from '../../services/IOcrAdapter';
import { IQuotationParsingStrategy, NormalizedQuotation } from '../../ai/IQuotationParsingStrategy';
import { IPdfConverter } from '../../../infrastructure/files/IPdfConverter';
import { IOcrDocumentService, OcrDocumentService } from '../../services/IOcrDocumentService';

export interface ProcessQuotationUploadInput {
  /** App-private URI to the file (already copied by QuotationScreen) */
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
 * Orchestrates the end-to-end pipeline after a file has been selected and
 * copied to app private storage:
 *   1. (PDF only) Convert PDF pages to images via IPdfConverter
 *   2. OCR → extract raw text from the image(s)
 *   3. parse → strategy parses OcrResult into NormalizedQuotation
 *   4. Return normalized result + a QuotationDocumentRef ready for atomic save
 */
export class ProcessQuotationUploadUseCase {
  constructor(
    private readonly ocrAdapter: IOcrAdapter,
    private readonly parsingStrategy: IQuotationParsingStrategy,
    private readonly pdfConverter?: IPdfConverter,
    private readonly ocrDocumentService: IOcrDocumentService = new OcrDocumentService(ocrAdapter),
  ) {}

  async execute(
    input: ProcessQuotationUploadInput,
  ): Promise<ProcessQuotationUploadOutput> {
    const { fileUri, filename, mimeType, fileSize } = input;

    const documentRef: QuotationDocumentRef = {
      localPath: fileUri,
      filename,
      size: fileSize,
      mimeType,
    };

    // ── PDF path ─────────────────────────────────────────────────────────────
    if (mimeType === 'application/pdf') {
      if (!this.pdfConverter) {
        return {
          normalized: emptyNormalizedQuotation(),
          documentRef,
          rawOcrText: '',
        };
      }

      try {
        return await this.processPdf(fileUri, documentRef);
      } catch (err: any) {
        throw new Error(
          `Quotation processing failed: ${err?.message ?? 'Unknown error'}`,
        );
      }
    }

    // ── Image path ───────────────────────────────────────────────────────────
    try {
      const ocrResult = await this.ocrAdapter.extractText(fileUri);
      const rawOcrText = ocrResult.fullText;

      const normalized = await this.parsingStrategy.parse(ocrResult);

      return { normalized, documentRef, rawOcrText };
    } catch (err: any) {
      throw new Error(
        `Quotation processing failed: ${err?.message ?? 'Unknown error'}`,
      );
    }
  }

  private async processPdf(
    pdfUri: string,
    documentRef: QuotationDocumentRef,
  ): Promise<ProcessQuotationUploadOutput> {
    const pages = await this.pdfConverter!.convertToImages(pdfUri);

    if (pages.length === 0) {
      return {
        normalized: emptyNormalizedQuotation(),
        documentRef,
        rawOcrText: '',
      };
    }

    const pageImageUris = pages.map((page) => page.uri);
    const documentOcrResult = await this.ocrDocumentService.extractFromPages(pageImageUris);
    const rawOcrText = documentOcrResult.rawText;

    const normalized = await this.parsingStrategy.parse(documentOcrResult.merged);

    return { normalized, documentRef, rawOcrText };
  }
}

function emptyNormalizedQuotation(): NormalizedQuotation {
  return {
    reference: null,
    vendor: null,
    vendorEmail: null,
    vendorPhone: null,
    vendorAddress: null,
    taxId: null,
    date: null,
    expiryDate: null,
    currency: 'AUD',
    subtotal: null,
    tax: null,
    total: null,
    lineItems: [],
    paymentTerms: null,
    scope: null,
    exclusions: null,
    notes: null,
    confidence: {
      overall: 0,
      vendor: 0,
      reference: 0,
      date: 0,
      total: 0,
    },
    suggestedCorrections: [],
  };
}
