import { AnalyticsAdapter } from './AnalyticsAdapter';

/**
 * Composite analytics adapter that fans all calls to a list of child adapters.
 *
 * If the injected `optOutProvider` returns `true`, every call is silently
 * dropped — no events are forwarded to any child adapter.
 */
export class CompositeAnalyticsAdapter extends AnalyticsAdapter {
  constructor(
    private readonly adapters: AnalyticsAdapter[],
    private readonly optOutProvider: () => boolean = () => false,
  ) {
    super();
  }

  identify(userId: string, traits?: Record<string, unknown>): void {
    if (this.optOutProvider()) return;
    this.adapters.forEach(a => a.identify(userId, traits));
  }

  track(event: string, properties?: Record<string, unknown>): void {
    if (this.optOutProvider()) return;
    this.adapters.forEach(a => a.track(event, properties));
  }

  screen(screenName: string, properties?: Record<string, unknown>): void {
    if (this.optOutProvider()) return;
    this.adapters.forEach(a => a.screen(screenName, properties));
  }

  reset(): void {
    if (this.optOutProvider()) return;
    this.adapters.forEach(a => a.reset());
  }
}
