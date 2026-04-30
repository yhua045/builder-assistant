import { IPdfConverter } from '../../../../infrastructure/files/IPdfConverter';
import { IReceiptVisionParsingStrategy } from '../../application/IReceiptVisionParsingStrategy';
import { NormalizedReceipt } from '../../application/IReceiptNormalizer';
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
    suggestedCorrections: [],
  };
}

export class VisionBasedReceiptProcessor implements IReceiptDocumentProcessor {
  constructor(
    private readonly visionStrategy: IReceiptVisionParsingStrategy,
    private readonly pdfConverter: IPdfConverter,
  ) {}

  async process(localUri: string, mimeType: string): Promise<ReceiptProcessorResult> {
    if (mimeType === 'application/pdf') {
      const pages = await this.pdfConverter.convertToImages(localUri);
      if (pages.length === 0) {
        return { normalized: emptyNormalizedReceipt(), rawOcrText: '' };
      }
      const normalized = await this.visionStrategy.parse(pages[0].uri);
      return { normalized, rawOcrText: '' };
    }

    const normalized = await this.visionStrategy.parse(localUri);
    return { normalized, rawOcrText: '' };
  }
}
