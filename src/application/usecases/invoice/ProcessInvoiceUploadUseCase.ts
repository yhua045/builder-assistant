import { IOcrAdapter, OcrResult } from '../../services/IOcrAdapter';
import { IInvoiceNormalizer, NormalizedInvoice } from '../../ai/IInvoiceNormalizer';
import { IPdfConverter } from '../../../infrastructure/files/IPdfConverter';

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
 *   1. (PDF only) Convert PDF pages to images via IPdfConverter
 *   2. OCR → extract raw text from the image(s)
 *   3. extractCandidates → convert raw text into structured field candidates
 *   4. normalize → apply business rules and return a NormalizedInvoice
 *   5. Return normalized result + a DocumentRef ready for atomic save
 *
 * When `pdfConverter` is provided and the uploaded file is a PDF, each page is
 * rendered to a raster image and fed through the OCR pipeline. If no
 * `pdfConverter` is supplied, PDF uploads fall back to returning an empty
 * NormalizedInvoice so the user can fill the form manually (backward-compatible
 * behaviour).
 */
export class ProcessInvoiceUploadUseCase {
  constructor(
    private readonly ocrAdapter: IOcrAdapter,
    private readonly normalizer: IInvoiceNormalizer,
    private readonly pdfConverter?: IPdfConverter,
  ) {}

  async execute(input: ProcessInvoiceUploadInput): Promise<ProcessInvoiceUploadOutput> {
    const { fileUri, filename, mimeType, fileSize } = input;

    const documentRef: DocumentRef = {
      localPath: fileUri,
      filename,
      size: fileSize,
      mimeType,
    };

    // ── PDF path ─────────────────────────────────────────────────────────────
    if (mimeType === 'application/pdf') {
      // If no converter is wired up, fall back to empty result (graceful degradation)
      if (!this.pdfConverter) {
        return {
          normalized: this.emptyNormalizedInvoice(),
          documentRef,
          rawOcrText: '',
        };
      }

      try {
        return await this.processPdf(fileUri, documentRef);
      } catch (err: any) {
        throw new Error(
          `Invoice processing failed: ${err?.message ?? 'Unknown error'}`,
        );
      }
    }

    // ── Image path ───────────────────────────────────────────────────────────
    try {
      const ocrResult = await this.ocrAdapter.extractText(fileUri);
      const rawOcrText = ocrResult.fullText;

      const candidates = this.normalizer.extractCandidates(rawOcrText);
      const normalized = await this.normalizer.normalize(candidates, ocrResult);

      return { normalized, documentRef, rawOcrText };
    } catch (err: any) {
      throw new Error(
        `Invoice processing failed: ${err?.message ?? 'Unknown error'}`,
      );
    }
  }

  // ─── private helpers ──────────────────────────────────────────────────────

  /**
   * Convert a PDF to images, run OCR on every page, merge the text, and
   * pass the result through the normalizer pipeline.
   */
  private async processPdf(
    pdfUri: string,
    documentRef: DocumentRef,
  ): Promise<ProcessInvoiceUploadOutput> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const pages = await this.pdfConverter!.convertToImages(pdfUri);

    if (pages.length === 0) {
      return {
        normalized: this.emptyNormalizedInvoice(),
        documentRef,
        rawOcrText: '',
      };
    }

    // Run OCR on each page sequentially to avoid memory pressure
    const pageTexts: string[] = [];
    let firstOcrResult: OcrResult | null = null;

    for (const page of pages) {
      const ocrResult = await this.ocrAdapter.extractText(page.uri);
      pageTexts.push(ocrResult.fullText);
      if (firstOcrResult === null) {
        firstOcrResult = ocrResult;
      }
    }

    // Combine page texts with page separators
    const rawOcrText =
      pages.length === 1
        ? pageTexts[0]
        : pageTexts
            .map((text, idx) => `--- Page ${idx + 1} ---\n${text}`)
            .join('\n\n');

    const candidates = this.normalizer.extractCandidates(rawOcrText);
    // Use first page's OcrResult for layout context; pass combined text via candidates
    const normalized = await this.normalizer.normalize(candidates, firstOcrResult!);

    return { normalized, documentRef, rawOcrText };
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
