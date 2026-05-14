import analytics from '@react-native-firebase/analytics';
import { AnalyticsAdapter } from './AnalyticsAdapter';

/**
 * Firebase Analytics adapter.
 *
 * Wraps `@react-native-firebase/analytics` so that application/domain code
 * never imports the Firebase SDK directly.
 */
export class FirebaseAnalyticsAdapter extends AnalyticsAdapter {
  identify(userId: string, _traits?: Record<string, unknown>): void {
    analytics().setUserId(userId);
  }

  track(event: string, properties?: Record<string, unknown>): void {
    analytics().logEvent(event, properties);
  }

  screen(screenName: string, _properties?: Record<string, unknown>): void {
    analytics().logScreenView({
      screen_name: screenName,
      screen_class: screenName,
    });
  }

  reset(): void {
    analytics().resetAnalyticsData();
  }
}
