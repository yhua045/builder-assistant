import { IOcrAdapter } from '../../../application/services/IOcrAdapter';
import { IInvoiceNormalizer, NormalizedInvoice } from './IInvoiceNormalizer';
import { IPdfConverter } from '../../../infrastructure/files/IPdfConverter';
import { IFileSystemAdapter } from '../../../infrastructure/files/IFileSystemAdapter';
import { IOcrDocumentService, OcrDocumentService } from '../../../application/services/IOcrDocumentService';
import { validatePdfFile } from '../../../utils/fileValidation';
import { IInvoiceParsingStrategy } from './IInvoiceParsingStrategy';

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
 *   2. File IO: Copies the file to app private storage (if fileSystemAdapter provided)
 *   3. (PDF only) Convert PDF pages to images via IPdfConverter
 *   4. OCR → extract raw text from the image(s)
 *   5. extractCandidates → convert raw text into structured field candidates
 *   6. normalize → apply business rules and return a NormalizedInvoice
 *   7. Return normalized result + a DocumentRef ready for atomic save
 *
 * All OCR and normalizer adapters are optional: when absent the use case still
 * validates and copies the file and returns an empty NormalizedInvoice so the
 * caller can fall back to manual entry (graceful degradation).
 */
export class ProcessInvoiceUploadUseCase {
  private readonly ocrDocumentService?: IOcrDocumentService;

  constructor(
    private readonly ocrAdapter?: IOcrAdapter,
    private readonly normalizer?: IInvoiceNormalizer,
    private readonly pdfConverter?: IPdfConverter,
    private readonly fileSystemAdapter?: IFileSystemAdapter,
    private readonly parsingStrategy?: IInvoiceParsingStrategy,
  ) {
    if (ocrAdapter) {
      this.ocrDocumentService = new OcrDocumentService(ocrAdapter);
    }
  }

  async execute(input: ProcessInvoiceUploadInput): Promise<ProcessInvoiceUploadOutput> {
    const { fileUri: originalUri, filename, mimeType, fileSize } = input;

    // 1. Cross-cutting file validation
    const validation = validatePdfFile(mimeType, fileSize);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.error || 'Invalid file'}`);
    }

    // 2. IO logic: copy to app-private storage (when adapter provided)
    let localUri = originalUri;
    if (this.fileSystemAdapter) {
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).slice(2, 8);
      const destinationFilename = `invoice_${timestamp}_${randomSuffix}.pdf`;
      localUri = await this.fileSystemAdapter.copyToAppStorage(originalUri, destinationFilename);
    }

    const documentRef: DocumentRef = {
      localPath: localUri,
      filename,
      size: fileSize,
      mimeType,
    };

    // 3. If OCR adapters are absent, return empty result (graceful degradation)
    if (!this.ocrAdapter || !this.normalizer) {
      return {
        normalized: this.emptyNormalizedInvoice(),
        documentRef,
        rawOcrText: '',
      };
    }

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
        return await this.processPdf(localUri, documentRef);
      } catch (err: any) {
        throw new Error(
          `Invoice processing failed: ${err?.message ?? 'Unknown error'}`,
        );
      }
    }

    // ── Image path ───────────────────────────────────────────────────────────
    try {
      const ocrResult = await this.ocrAdapter.extractText(localUri);
      const rawOcrText = ocrResult.fullText;

      console.log('[InvoiceOCR] Single file OCR extracted', {
        localUri,
        fullTextLength: ocrResult.fullText.length,
        tokenCount: ocrResult.tokens.length,
        ocrResult,
      });

      // Prefer LLM strategy (new); fall back to deterministic normalizer (legacy)
      if (this.parsingStrategy) {
        const normalized = await this.parsingStrategy.parse(ocrResult);
        return { normalized, documentRef, rawOcrText };
      }

      const candidates = this.normalizer.extractCandidates(rawOcrText);
      console.log('[InvoiceOCR] Candidate extraction (single file)', {
        localUri,
        candidates,
      });

      const normalized = await this.normalizer.normalize(candidates, ocrResult);
      console.log('[InvoiceOCR] Normalized invoice (single file)', {
        localUri,
        normalized,
      });

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
     
    const pages = await this.pdfConverter!.convertToImages(pdfUri);

    console.log('[InvoiceOCR] PDF converted to images', {
      pdfUri,
      pageCount: pages.length,
      pageImageUris: pages.map((page) => page.uri),
    });

    if (pages.length === 0) {
      return {
        normalized: this.emptyNormalizedInvoice(),
        documentRef,
        rawOcrText: '',
      };
    }

    const pageImageUris = pages.map((page) => page.uri);
    // ocrDocumentService and normalizer are guaranteed non-null here:
    // processPdf is only called after the guard `if (!this.ocrAdapter || !this.normalizer)` above.
    const documentOcrResult = await this.ocrDocumentService!.extractFromPages(pageImageUris);
    const rawOcrText = documentOcrResult.rawText;

    console.log('[InvoiceOCR] OCR extracted from converted pages', {
      pdfUri,
      pageCount: documentOcrResult.pageCount,
      rawTextLength: rawOcrText.length,
      mergedTokenCount: documentOcrResult.merged.tokens.length,
      mergedOcrResult: documentOcrResult.merged,
    });

    const candidates = this.normalizer!.extractCandidates(rawOcrText);
    console.log('[InvoiceOCR] Candidate extraction (PDF)', {
      pdfUri,
      pageCount: documentOcrResult.pageCount,
      candidates,
    });

    const normalized = await this.normalizer!.normalize(candidates, documentOcrResult.merged);
    console.log('[InvoiceOCR] Normalized invoice (PDF)', {
      pdfUri,
      pageCount: documentOcrResult.pageCount,
      normalized,
    });

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
