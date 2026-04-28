// Public screen
export { SnapReceiptScreen } from './screens/SnapReceiptScreen';

// Public hooks (consumed by shared screens such as Dashboard)
export { useSnapReceipt } from './hooks/useSnapReceipt';
export { useSnapReceiptScreen } from './hooks/useSnapReceiptScreen';

// Public types needed by callers
export type { SnapReceiptDTO } from './application/SnapReceiptUseCase';
export type { NormalizedReceipt } from './application/IReceiptNormalizer';
export type { IReceiptParsingStrategy } from './application/IReceiptParsingStrategy';
