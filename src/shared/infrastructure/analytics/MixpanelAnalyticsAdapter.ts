import { Mixpanel } from 'mixpanel-react-native';
import { AnalyticsAdapter } from './AnalyticsAdapter.ts';

/**
 * Mixpanel analytics adapter.
 *
 * Wraps `mixpanel-react-native` so that application/domain code never
 * imports the Mixpanel SDK directly.  The token is injected at
 * construction time via the DI factory in `registerServices.ts`.
 */
export class MixpanelAnalyticsAdapter extends AnalyticsAdapter {
  private readonly client: InstanceType<typeof Mixpanel> | null;

  constructor(token?: string | null) {
    super();

    const normalizedToken = typeof token === 'string' ? token.trim() : '';
    this.client = normalizedToken ? new Mixpanel(normalizedToken, true) : null;

    if (this.client) {
      // init() is async but fire-and-forget per the non-functional requirement
      // (adapter calls must not block the call chain).
      void this.client.init();
    }
  }

  identify(userId: string, _traits?: Record<string, unknown>): void {
    this.client?.identify(userId);
  }

  track(event: string, properties?: Record<string, unknown>): void {
    this.client?.track(event, properties);
  }

  screen(screenName: string, properties?: Record<string, unknown>): void {
    if (!this.client) return;
    this.client.track('screen_view', { screen_name: screenName, ...properties });
  }

  reset(): void {
    this.client?.reset();
  }
}
