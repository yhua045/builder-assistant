import { Mixpanel } from 'mixpanel-react-native';
import { AnalyticsAdapter } from './AnalyticsAdapter';

/**
 * Mixpanel analytics adapter.
 *
 * Wraps `mixpanel-react-native` so that application/domain code never
 * imports the Mixpanel SDK directly.  The token is injected at
 * construction time via the DI factory in `registerServices.ts`.
 */
export class MixpanelAnalyticsAdapter extends AnalyticsAdapter {
  private readonly client: InstanceType<typeof Mixpanel>;

  constructor(token: string) {
    super();
    this.client = new Mixpanel(token, true);
    // init() is async but fire-and-forget per the non-functional requirement
    // (adapter calls must not block the call chain).
    void this.client.init();
  }

  identify(userId: string, _traits?: Record<string, unknown>): void {
    this.client.identify(userId);
  }

  track(event: string, properties?: Record<string, unknown>): void {
    this.client.track(event, properties);
  }

  screen(screenName: string, properties?: Record<string, unknown>): void {
    this.client.track('screen_view', { screen_name: screenName, ...properties });
  }

  reset(): void {
    this.client.reset();
  }
}
