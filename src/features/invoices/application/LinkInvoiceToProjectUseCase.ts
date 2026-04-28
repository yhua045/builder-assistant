import { InvoiceRepository } from '../../../domain/repositories/InvoiceRepository';
import { InvoiceNotEditableError } from '../../../features/payments/application/PaymentErrors';

export interface LinkInvoiceToProjectInput {
  invoiceId: string;
  projectId: string | undefined;
}

export class LinkInvoiceToProjectUseCase {
  constructor(private readonly invoiceRepo: InvoiceRepository) {}

  async execute({ invoiceId, projectId }: LinkInvoiceToProjectInput): Promise<void> {
    const invoice = await this.invoiceRepo.getInvoice(invoiceId);
    if (!invoice) {
      throw new Error(`Invoice not found: ${invoiceId}`);
    }
    if (invoice.status === 'cancelled') {
      throw new InvoiceNotEditableError(invoiceId, 'invoice is cancelled');
    }
    if (invoice.paymentStatus === 'paid') {
      throw new InvoiceNotEditableError(invoiceId, 'invoice is paid');
    }
    if (projectId !== undefined) {
      await this.invoiceRepo.assignProject(invoiceId, projectId);
    } else {
      await this.invoiceRepo.updateInvoice(invoiceId, { projectId: undefined });
    }
  }
}
