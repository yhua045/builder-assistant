// Public screens (navigation entry points)
export { InvoiceScreen } from './screens/InvoiceScreen';
export { default as InvoiceListPage } from './screens/InvoiceListPage';
export { default as InvoiceDetailPage } from './screens/InvoiceDetailPage';

// Public hooks consumed by cross-feature callers
export { useInvoices } from './hooks/useInvoices';

// Public types consumed by dashboard, payments, tests
export type { IInvoiceNormalizer, NormalizedInvoice, NormalizedInvoiceLineItem, InvoiceCandidates } from './application/IInvoiceNormalizer';
export { InvoiceNormalizer } from './application/InvoiceNormalizer';

// Utility consumed by usePayments (global hook)
export { resolveInvoiceDueDate } from './utils/resolveInvoiceDueDate';

// Utility that may be consumed by quotation feature in future
export { normalizedInvoiceToQuotationFormValues } from './utils/normalizedInvoiceToQuotationFormValues';
