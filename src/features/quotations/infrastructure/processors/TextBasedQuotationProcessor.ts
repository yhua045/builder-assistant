import { IOcrAdapter } from '../../../../application/services/IOcrAdapter';
import { OcrDocumentService } from '../../../../application/services/IOcrDocumentService';
import { IPdfConverter } from '../../../../infrastructure/files/IPdfConverter';
import {
  IQuotationParsingStrategy,
  NormalizedQuotation,
} from '../../application/ai/IQuotationParsingStrategy';
import {
  IQuotationDocumentProcessor,
  QuotationProcessorResult,
} from '../../application/IQuotationDocumentProcessor';

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
    confidence: { overall: 0, vendor: 0, reference: 0, date: 0, total: 0 },
    suggestedCorrections: [
      'PDF text extraction is not yet supported — please fill in the details manually',
    ],
  };
}

export class TextBasedQuotationProcessor implements IQuotationDocumentProcessor {
  private readonly ocrDocumentService: OcrDocumentService;

  constructor(
    private readonly ocrAdapter: IOcrAdapter,
    private readonly pdfConverter: IPdfConverter,
    private readonly parsingStrategy: IQuotationParsingStrategy,
  ) {
    this.ocrDocumentService = new OcrDocumentService(ocrAdapter);
  }

  async process(localUri: string, mimeType: string): Promise<QuotationProcessorResult> {
    if (mimeType === 'application/pdf') {
      return this.processPdf(localUri);
    }
    return this.processImage(localUri);
  }

  private async processPdf(pdfUri: string): Promise<QuotationProcessorResult> {
    const pages = await this.pdfConverter.convertToImages(pdfUri);
    if (pages.length === 0) {
      return { normalized: emptyNormalizedQuotation(), rawOcrText: '' };
    }

    const pageImageUris = pages.map((p) => p.uri);
    const documentOcrResult = await this.ocrDocumentService.extractFromPages(pageImageUris);
    const rawOcrText = documentOcrResult.rawText;
    const normalized = await this.parsingStrategy.parse(documentOcrResult.merged);
    return { normalized, rawOcrText };
  }

  private async processImage(imageUri: string): Promise<QuotationProcessorResult> {
    const ocrResult = await this.ocrAdapter.extractText(imageUri);
    const rawOcrText = ocrResult.fullText;
    const normalized = await this.parsingStrategy.parse(ocrResult);
    return { normalized, rawOcrText };
  }
}
