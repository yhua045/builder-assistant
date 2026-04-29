import { IOcrAdapter } from '../../../application/services/IOcrAdapter';
import { IQuotationParsingStrategy, NormalizedQuotation } from './ai/IQuotationParsingStrategy';
import { IPdfConverter } from '../../../infrastructure/files/IPdfConverter';
import { IOcrDocumentService, OcrDocumentService } from '../../../application/services/IOcrDocumentService';
import { IFileSystemAdapter } from '../../../infrastructure/files/IFileSystemAdapter';
import { validatePdfFile } from '../../../utils/fileValidation';
import { IQuotationVisionParsingStrategy } from './ai/IQuotationVisionParsingStrategy';

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
 *   2. File IO: Copies the file to app private storage (if fileSystemAdapter provided)
 *   3. (PDF only) Convert PDF pages to images via IPdfConverter
 *   4. OCR → extract raw text from the image(s)
 *   5. parse → strategy parses OcrResult into NormalizedQuotation
 *   6. Return normalized result + a QuotationDocumentRef ready for atomic save
 */
export class ProcessQuotationUploadUseCase {
  private readonly ocrDocumentService?: IOcrDocumentService;

  constructor(
    private readonly parsingStrategy?: IQuotationParsingStrategy,
    private readonly pdfConverter?: IPdfConverter,
    private readonly fileSystemAdapter?: IFileSystemAdapter,
    private readonly ocrAdapter?: IOcrAdapter,
    private readonly visionStrategy?: IQuotationVisionParsingStrategy,
  ) {
    if (ocrAdapter) {
      this.ocrDocumentService = new OcrDocumentService(ocrAdapter);
    }
  }

  async execute(
    input: ProcessQuotationUploadInput,
  ): Promise<ProcessQuotationUploadOutput> {
    const { fileUri: originalUri, filename, mimeType, fileSize } = input;

    // 1. Cross-cutting file validation
    const validation = validatePdfFile(mimeType, fileSize);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.error || 'Invalid file'}`);
    }

    // 2. IO logic moved to application layer: copy to private storage
    let localPath = originalUri;
    if (this.fileSystemAdapter) {
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).slice(2, 8);
      const destinationFilename = `quote_${timestamp}_${randomSuffix}.pdf`;
      localPath = await this.fileSystemAdapter.copyToAppStorage(originalUri, destinationFilename);
    }

    const documentRef: QuotationDocumentRef = {
      localPath,
      filename,
      size: fileSize,
      mimeType,
    };

    // ── PDF path ─────────────────────────────────────────────────────────────
    if (mimeType === 'application/pdf') {
      // Vision PDF path: convert → take page 1 → send to vision model
      if (this.visionStrategy && this.pdfConverter) {
        try {
          return await this.processPdfVision(localPath, documentRef);
        } catch (err: any) {
          throw new Error(
            `Quotation processing failed: ${err?.message ?? 'Unknown error'}`,
          );
        }
      }

      if (!this.pdfConverter || !this.parsingStrategy || !this.ocrDocumentService) {
        return {
          normalized: emptyNormalizedQuotation(),
          documentRef,
          rawOcrText: '',
        };
      }

      try {
        return await this.processPdf(localPath, documentRef);
      } catch (err: any) {
        throw new Error(
          `Quotation processing failed: ${err?.message ?? 'Unknown error'}`,
        );
      }
    }

    // ── Image path ───────────────────────────────────────────────────────────

    // Vision path (skip OCR)
    if (this.visionStrategy) {
      try {
        const normalized = await this.visionStrategy.parse(localPath);
        return { normalized, documentRef, rawOcrText: '' };
      } catch (err: any) {
        throw new Error(
          `Quotation processing failed: ${err?.message ?? 'Unknown error'}`,
        );
      }
    }

    if (!this.ocrAdapter || !this.parsingStrategy) {
      return {
        normalized: emptyNormalizedQuotation(),
        documentRef,
        rawOcrText: '',
      };
    }

    try {
      const ocrResult = await this.ocrAdapter.extractText(localPath);
      const rawOcrText = ocrResult.fullText;

      const normalized = await this.parsingStrategy.parse(ocrResult);

      return { normalized, documentRef, rawOcrText };
    } catch (err: any) {
      throw new Error(
        `Quotation processing failed: ${err?.message ?? 'Unknown error'}`,
      );
    }
  }

  private async processPdfVision(
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
    const firstPageUri = pages[0].uri;
    const normalized = await this.visionStrategy!.parse(firstPageUri);
    return { normalized, documentRef, rawOcrText: '' };
  }

  private async processPdf(
    pdfUri: string,
    documentRef: QuotationDocumentRef,
  ): Promise<ProcessQuotationUploadOutput> {
    if (!this.pdfConverter || !this.ocrDocumentService || !this.parsingStrategy) {
        throw new Error('Dependencies missing for PDF parsing');
    }
    const pages = await this.pdfConverter.convertToImages(pdfUri);

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
