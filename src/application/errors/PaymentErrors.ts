export class PaymentNotPendingError extends Error {
  constructor(paymentId: string, status: string) {
    super(`Payment ${paymentId} is not pending (status: ${status})`);
    this.name = 'PaymentNotPendingError';
  }
}

export class InvoiceNotEditableError extends Error {
  constructor(invoiceId: string, reason: string) {
    super(`Invoice ${invoiceId} is not editable: ${reason}`);
    this.name = 'InvoiceNotEditableError';
  }
}
