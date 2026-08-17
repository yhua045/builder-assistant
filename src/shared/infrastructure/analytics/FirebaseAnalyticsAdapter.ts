import analytics from '@react-native-firebase/analytics';
import { AnalyticsAdapter } from './AnalyticsAdapter.ts';

/**
 * Firebase Analytics adapter.
 *
 * Wraps `@react-native-firebase/analytics` so that application/domain code
 * never imports the Firebase SDK directly.
 */
export class FirebaseAnalyticsAdapter extends AnalyticsAdapter {
  private safeFirebaseCall<T>(operation: () => T): T | undefined {
    try {
      return operation();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("No Firebase App") || message.includes("firebase.initializeApp")) {
        return undefined;
      }

      throw error;
    }
  }

  identify(userId: string, _traits?: Record<string, unknown>): void {
    this.safeFirebaseCall(() => analytics().setUserId(userId));
  }

  track(event: string, properties?: Record<string, unknown>): void {
    this.safeFirebaseCall(() => analytics().logEvent(event, properties));
  }

  screen(screenName: string, _properties?: Record<string, unknown>): void {
    this.safeFirebaseCall(() => analytics().logScreenView({
      screen_name: screenName,
      screen_class: screenName,
    }));
  }

  reset(): void {
    this.safeFirebaseCall(() => analytics().resetAnalyticsData());
  }
}
