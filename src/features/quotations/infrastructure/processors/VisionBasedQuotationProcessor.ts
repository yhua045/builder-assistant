import { IPdfConverter } from '../../../../infrastructure/files/IPdfConverter';
import { IQuotationVisionParsingStrategy } from '../../application/ai/IQuotationVisionParsingStrategy';
import { NormalizedQuotation } from '../../application/ai/IQuotationParsingStrategy';
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
    suggestedCorrections: [],
  };
}

export class VisionBasedQuotationProcessor implements IQuotationDocumentProcessor {
  constructor(
    private readonly visionStrategy: IQuotationVisionParsingStrategy,
    private readonly pdfConverter: IPdfConverter,
  ) {}

  async process(localUri: string, mimeType: string): Promise<QuotationProcessorResult> {
    if (mimeType === 'application/pdf') {
      const pages = await this.pdfConverter.convertToImages(localUri);
      if (pages.length === 0) {
        return { normalized: emptyNormalizedQuotation(), rawOcrText: '' };
      }
      const normalized = await this.visionStrategy.parse(pages[0].uri);
      return { normalized, rawOcrText: '' };
    }

    const normalized = await this.visionStrategy.parse(localUri);
    return { normalized, rawOcrText: '' };
  }
}
