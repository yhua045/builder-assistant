import { IOcrAdapter } from '../../../../application/services/IOcrAdapter';
import { OcrDocumentService } from '../../../../application/services/IOcrDocumentService';
import { IPdfConverter } from '../../../../infrastructure/files/IPdfConverter';
import { IInvoiceNormalizer, NormalizedInvoice } from '../../application/IInvoiceNormalizer';
import { IInvoiceParsingStrategy } from '../../application/IInvoiceParsingStrategy';
import {
  IInvoiceDocumentProcessor,
  InvoiceProcessorResult,
} from '../../application/IInvoiceDocumentProcessor';

function emptyNormalizedInvoice(): NormalizedInvoice {
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
    confidence: { overall: 0, vendor: 0, invoiceNumber: 0, invoiceDate: 0, total: 0 },
    suggestedCorrections: [
      'PDF text extraction is not yet supported — please fill in the details manually',
    ],
  };
}

export class TextBasedInvoiceProcessor implements IInvoiceDocumentProcessor {
  private readonly ocrDocumentService: OcrDocumentService;

  constructor(
    private readonly ocrAdapter: IOcrAdapter,
    private readonly pdfConverter: IPdfConverter,
    private readonly parsingStrategy: IInvoiceParsingStrategy,
    private readonly normalizer?: IInvoiceNormalizer,
  ) {
    this.ocrDocumentService = new OcrDocumentService(ocrAdapter);
  }

  async process(localUri: string, mimeType: string): Promise<InvoiceProcessorResult> {
    if (mimeType === 'application/pdf') {
      return this.processPdf(localUri);
    }
    return this.processImage(localUri);
  }

  private async processPdf(pdfUri: string): Promise<InvoiceProcessorResult> {
    const pages = await this.pdfConverter.convertToImages(pdfUri);
    if (pages.length === 0) {
      return { normalized: emptyNormalizedInvoice(), rawOcrText: '' };
    }

    const pageImageUris = pages.map((p) => p.uri);
    const documentOcrResult = await this.ocrDocumentService.extractFromPages(pageImageUris);
    const rawOcrText = documentOcrResult.rawText;

    if (this.parsingStrategy) {
      const normalized = await this.parsingStrategy.parse(documentOcrResult.merged);
      return { normalized, rawOcrText };
    }

    if (this.normalizer) {
      const candidates = this.normalizer.extractCandidates(rawOcrText);
      const normalized = await this.normalizer.normalize(candidates, documentOcrResult.merged);
      return { normalized, rawOcrText };
    }

    return { normalized: emptyNormalizedInvoice(), rawOcrText };
  }

  private async processImage(imageUri: string): Promise<InvoiceProcessorResult> {
    const ocrResult = await this.ocrAdapter.extractText(imageUri);
    const rawOcrText = ocrResult.fullText;

    if (this.parsingStrategy) {
      const normalized = await this.parsingStrategy.parse(ocrResult);
      return { normalized, rawOcrText };
    }

    if (this.normalizer) {
      const candidates = this.normalizer.extractCandidates(rawOcrText);
      const normalized = await this.normalizer.normalize(candidates, ocrResult);
      return { normalized, rawOcrText };
    }

    return { normalized: emptyNormalizedInvoice(), rawOcrText };
  }
}
