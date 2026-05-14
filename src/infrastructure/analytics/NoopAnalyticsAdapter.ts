import { AnalyticsAdapter } from './AnalyticsAdapter';

type Call = { method: string; args: unknown[] };

/**
 * No-op analytics adapter used in tests and when the user opts out.
 *
 * Records every call so test code can assert behaviour without a
 * real analytics provider.
 */
export class NoopAnalyticsAdapter extends AnalyticsAdapter {
  readonly calls: Call[] = [];

  identify(userId: string, traits?: Record<string, unknown>): void {
    this.calls.push({ method: 'identify', args: [userId, traits] });
  }

  track(event: string, properties?: Record<string, unknown>): void {
    this.calls.push({ method: 'track', args: [event, properties] });
  }

  screen(screenName: string, properties?: Record<string, unknown>): void {
    this.calls.push({ method: 'screen', args: [screenName, properties] });
  }

  reset(): void {
    this.calls.push({ method: 'reset', args: [] });
  }

  getCallsFor(method: string): Call[] {
    return this.calls.filter(c => c.method === method);
  }

  clearCalls(): void {
    this.calls.length = 0;
  }
}
