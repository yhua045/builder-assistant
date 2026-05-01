import { ErrorReportingAdapter } from './ErrorReportingAdapter';

type Call = { method: string; args: unknown[] };

/**
 * No-op error-reporting adapter used in tests.
 *
 * Records every call so test code can assert behaviour without a
 * real error-reporting provider.
 */
export class NoopErrorReportingAdapter extends ErrorReportingAdapter {
  readonly calls: Call[] = [];

  captureException(error: Error, context?: Record<string, unknown>): void {
    this.calls.push({ method: 'captureException', args: [error, context] });
  }

  captureMessage(message: string, level?: 'info' | 'warning' | 'error'): void {
    this.calls.push({ method: 'captureMessage', args: [message, level] });
  }

  setUser(userId: string): void {
    this.calls.push({ method: 'setUser', args: [userId] });
  }

  clearUser(): void {
    this.calls.push({ method: 'clearUser', args: [] });
  }

  getCallsFor(method: string): Call[] {
    return this.calls.filter(c => c.method === method);
  }

  clearCalls(): void {
    this.calls.length = 0;
  }
}
