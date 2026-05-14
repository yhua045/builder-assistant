# Analytics and Error Monitoring Setup

This project wires application monitoring through the adapters in `src/infrastructure/analytics/` and registers them in `src/infrastructure/di/registerServices.ts`.

## What is already wired in code

- Firebase Analytics: `FirebaseAnalyticsAdapter`
- Mixpanel: `MixpanelAnalyticsAdapter`
- Sentry: `SentryErrorReportingAdapter`
- Composite analytics fan-out and opt-out handling: `CompositeAnalyticsAdapter`

The app resolves the adapters from DI, so UI and use-case code do not import provider SDKs directly.

## Environment values

The codebase currently expects these values from `@env`:

- `MIXPANEL_TOKEN`
- `SENTRY_DSN`
- `ANALYTICS_ENABLED`

For local test runs, the manual mock in `__mocks__/@env.js` provides placeholder values.

## Firebase Analytics setup

Firebase Analytics in React Native requires native project configuration.

### iOS

- Add `GoogleService-Info.plist` to the iOS app target.
- Ensure Firebase is initialized through the RNFirebase setup used by the app.
- Confirm the bundle identifier in Firebase matches the iOS app bundle id.

### Android

- Add `google-services.json` to `android/app/`.
- Ensure the Google Services Gradle plugin is applied as required by RNFirebase.
- Confirm the Android package name matches the Firebase app registration.

### Notes

- The adapter calls `analytics().logEvent(...)` and `analytics().logScreenView(...)`.
- Screen names should stay stable because they are used as analytics dimensions.

## Mixpanel setup

Mixpanel is configured from the DI container using `MIXPANEL_TOKEN`.

### Required steps

- Create or select a Mixpanel project.
- Copy the project token into `MIXPANEL_TOKEN`.
- Verify the app can initialize `mixpanel-react-native` on startup.
- Keep the token out of source control.

### Notes

- The adapter tracks both custom events and screen views.
- The current implementation fans events out through the composite analytics adapter, so Mixpanel receives the same events as Firebase.

## Sentry setup

Sentry is handled by `SentryErrorReportingAdapter`, which forwards exceptions and messages to `@sentry/react-native`.

### Required steps

- Create or select a Sentry project.
- Copy the DSN into `SENTRY_DSN`.
- Call `Sentry.init(...)` once during app bootstrap before any capture calls.
- Verify the release/environment values if you use them in Sentry dashboards.

### Notes

- The adapter captures exceptions, messages, and user identity.
- Unhandled promise rejections are routed through the app error boundary/bootstrap logic.

## Suggested setup order

1. Add the native Firebase configuration files for iOS and Android.
2. Set `MIXPANEL_TOKEN` and `SENTRY_DSN` in the environment used by the app.
3. Verify Sentry is initialized before the app renders.
4. Run the app and confirm screen views and test events arrive in Firebase and Mixpanel.
5. Trigger a sample error and confirm it appears in Sentry.

## Related files

- `src/infrastructure/analytics/FirebaseAnalyticsAdapter.ts`
- `src/infrastructure/analytics/MixpanelAnalyticsAdapter.ts`
- `src/infrastructure/analytics/SentryErrorReportingAdapter.ts`
- `src/infrastructure/di/registerServices.ts`
- `App.tsx`
- `design/issue-219-analytics-monitoring.md`
