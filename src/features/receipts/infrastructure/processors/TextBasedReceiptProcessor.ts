import { IOcrAdapter } from '../../../../application/services/IOcrAdapter';
import { OcrDocumentService } from '../../../../application/services/IOcrDocumentService';
import { IPdfConverter } from '../../../../infrastructure/files/IPdfConverter';
import { NormalizedReceipt } from '../../application/IReceiptNormalizer';
import { IReceiptParsingStrategy } from '../../application/IReceiptParsingStrategy';
import {
  IReceiptDocumentProcessor,
  ReceiptProcessorResult,
} from '../../application/IReceiptDocumentProcessor';

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
    confidence: { overall: 0, vendor: 0, date: 0, total: 0 },
    suggestedCorrections: [
      'PDF text extraction is not yet supported — please fill in the details manually',
    ],
  };
}

export class TextBasedReceiptProcessor implements IReceiptDocumentProcessor {
  private readonly ocrDocumentService: OcrDocumentService;

  constructor(
    private readonly ocrAdapter: IOcrAdapter,
    private readonly pdfConverter: IPdfConverter,
    private readonly parsingStrategy: IReceiptParsingStrategy,
  ) {
    this.ocrDocumentService = new OcrDocumentService(ocrAdapter);
  }

  async process(localUri: string, mimeType: string): Promise<ReceiptProcessorResult> {
    if (mimeType === 'application/pdf') {
      return this.processPdf(localUri);
    }
    return this.processImage(localUri);
  }

  private async processPdf(pdfUri: string): Promise<ReceiptProcessorResult> {
    const pages = await this.pdfConverter.convertToImages(pdfUri);
    if (pages.length === 0) {
      return { normalized: emptyNormalizedReceipt(), rawOcrText: '' };
    }

    const pageImageUris = pages.map((p) => p.uri);
    const documentOcrResult = await this.ocrDocumentService.extractFromPages(pageImageUris);
    const rawOcrText = documentOcrResult.rawText;
    const normalized = await this.parsingStrategy.parse(documentOcrResult.merged);
    return { normalized, rawOcrText };
  }

  private async processImage(imageUri: string): Promise<ReceiptProcessorResult> {
    const ocrResult = await this.ocrAdapter.extractText(imageUri);
    const rawOcrText = ocrResult.fullText;
    const normalized = await this.parsingStrategy.parse(ocrResult);
    return { normalized, rawOcrText };
  }
}
