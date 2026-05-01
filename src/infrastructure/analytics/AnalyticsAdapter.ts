/**
 * Abstract base class for all analytics adapters.
 *
 * Application code depends only on this abstraction — never on a
 * concrete provider (Firebase, Mixpanel, etc.).  Adapters are
 * registered in the DI container under the key 'AnalyticsAdapter'.
 */
export abstract class AnalyticsAdapter {
  /**
   * Associate subsequent events with a user identity.
   * Must NOT include PII (name, email, phone).
   */
  abstract identify(userId: string, traits?: Record<string, unknown>): void;

  /**
   * Record a discrete event.
   * @param event - snake_case event name (e.g. 'task_created')
   * @param properties - Optional flat key/value bag. No PII allowed.
   */
  abstract track(event: string, properties?: Record<string, unknown>): void;

  /**
   * Record a screen view.
   * @param screenName - Human-readable screen name (e.g. 'Dashboard')
   */
  abstract screen(screenName: string, properties?: Record<string, unknown>): void;

  /** Reset user identity (e.g. on logout). */
  abstract reset(): void;
}
