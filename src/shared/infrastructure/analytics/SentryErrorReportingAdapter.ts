import * as Sentry from '@sentry/react-native';
import { ErrorReportingAdapter } from './ErrorReportingAdapter.ts';

/**
 * Sentry error-reporting adapter.
 *
 * Wraps `@sentry/react-native` so that application/domain code never
 * imports the Sentry SDK directly.
 *
 * Sentry.init() must be called once at app startup (in App.tsx) before
 * any captureException/captureMessage calls are made.
 */
export class SentryErrorReportingAdapter extends ErrorReportingAdapter {
  captureException(error: Error, _context?: Record<string, unknown>): void {
    Sentry.captureException(error);
  }

  captureMessage(
    message: string,
    level: 'info' | 'warning' | 'error' = 'error',
  ): void {
    Sentry.captureMessage(message, level);
  }

  setUser(userId: string): void {
    Sentry.setUser({ id: userId });
  }

  clearUser(): void {
    Sentry.setUser(null);
  }
}
