/**
 * Pure domain type — no dependencies on any infrastructure or React.
 *
 * Convention for `name`: "<feature>.<verb>" with snake_case.
 * Examples: "screen.viewed", "dashboard.quick_actions_opened", "task.created"
 *
 * AC-4: `properties` must NEVER contain PII (names, addresses, financial values).
 */
export interface AnalyticsEvent {
  /** Namespaced event name. Convention: "<feature>.<action>" */
  name: string;
  /** ISO 8601 UTC timestamp — stamped by the service, not the caller */
  timestampUtc: string;
  /** Arbitrary structural metadata. No PII. */
  properties?: Record<string, string | number | boolean>;
}
