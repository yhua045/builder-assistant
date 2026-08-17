/**
 * Module-level opt-out flag shared between the DI-registered
 * CompositeAnalyticsAdapter and the useAnalyticsOptOut hook.
 *
 * The hook updates this value after reading/writing AsyncStorage so the
 * adapter always has the latest preference without being re-instantiated.
 */
let _isOptedOut = false;

/** Read the current opt-out state. Injected into CompositeAnalyticsAdapter. */
export function getOptOutState(): boolean {
  return _isOptedOut;
}

/** Update the opt-out state. Called by useAnalyticsOptOut when the value changes. */
export function setOptOutState(value: boolean): void {
  _isOptedOut = value;
}
