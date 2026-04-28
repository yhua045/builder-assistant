/**
 * Public API for the payments feature module.
 *
 * Only exports needed by other modules are exposed here.
 * Internal files (use cases, DrizzlePaymentRepository, etc.) are
 * accessed only via the DI container or relative imports within this feature.
 */

// Public screens (navigation entry points)
export { default as PaymentsNavigator } from './screens/PaymentsNavigator';
export { default as PaymentsScreen } from './screens/PaymentsScreen';

// Hooks consumed by cross-feature callers (ProjectDetail.tsx)
export { usePaymentsTimeline } from './hooks/usePaymentsTimeline';
export type { PaymentDayGroup } from './hooks/usePaymentsTimeline';

// Hook consumed by dashboard or other cross-feature callers
export { usePayments } from './hooks/usePayments';
export type { PaymentsMode, PaymentWithProject } from './hooks/usePayments';

// Errors barrel-exported so CancelInvoiceUseCase can import InvoiceNotEditableError
export { PaymentNotPendingError, InvoiceNotEditableError } from './application/PaymentErrors';

// Domain type (used internally; exported for cross-feature type needs)
export type { PaymentFeedItem } from './domain/PaymentFeedItem';
