/**
 * Abstract base class for all error-reporting adapters.
 *
 * Application code depends only on this abstraction — never on a
 * concrete provider (Sentry, etc.).  Adapters are registered in the
 * DI container under the key 'ErrorReportingAdapter'.
 */
export abstract class ErrorReportingAdapter {
  /**
   * Report a caught exception to the error-monitoring service.
   * @param error - The caught Error object.
   * @param context - Optional additional metadata (no PII).
   */
  abstract captureException(error: Error, context?: Record<string, unknown>): void;

  /**
   * Report a diagnostic message.
   * @param message - Plain string message.
   * @param level - Severity level (defaults to 'error').
   */
  abstract captureMessage(
    message: string,
    level?: 'info' | 'warning' | 'error',
  ): void;

  /** Attach a user identifier to subsequent error reports. No PII. */
  abstract setUser(userId: string): void;

  /** Remove the user identifier (e.g. on logout). */
  abstract clearUser(): void;
}
