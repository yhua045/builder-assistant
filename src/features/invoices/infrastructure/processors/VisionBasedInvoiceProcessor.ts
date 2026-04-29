import { IPdfConverter } from '../../../../infrastructure/files/IPdfConverter';
import { IInvoiceVisionParsingStrategy } from '../../application/IInvoiceVisionParsingStrategy';
import { NormalizedInvoice } from '../../application/IInvoiceNormalizer';
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
    suggestedCorrections: [],
  };
}

export class VisionBasedInvoiceProcessor implements IInvoiceDocumentProcessor {
  constructor(
    private readonly visionStrategy: IInvoiceVisionParsingStrategy,
    private readonly pdfConverter: IPdfConverter,
  ) {}

  async process(localUri: string, mimeType: string): Promise<InvoiceProcessorResult> {
    if (mimeType === 'application/pdf') {
      const pages = await this.pdfConverter.convertToImages(localUri);
      if (pages.length === 0) {
        return { normalized: emptyNormalizedInvoice(), rawOcrText: '' };
      }
      const normalized = await this.visionStrategy.parse(pages[0].uri);
      return { normalized, rawOcrText: '' };
    }

    const normalized = await this.visionStrategy.parse(localUri);
    return { normalized, rawOcrText: '' };
  }
}
