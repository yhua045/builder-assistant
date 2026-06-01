declare module '@env' {
  export const GROQ_API_KEY: string | undefined;
  export const VOICE_USE_MOCK_PARSER: string | undefined;
  export const FORCE_REAL_AUDIO: string | undefined;
  export const LOCATION_REMOTE_ENABLED: string | undefined;
  export const SEED_DEMO_DATA: string | undefined;
  export const RESET_DEMO_DATA: string | undefined;
  export const MIXPANEL_TOKEN: string | undefined;
  export const SENTRY_DSN: string | undefined;
  export const ANALYTICS_ENABLED: string | undefined;
  // Issue #226 — Optional login + premium OCR
  export const AUTH_ISSUER: string | undefined;
  export const AUTH_CLIENT_ID: string | undefined;
  export const AUTH_REDIRECT_URL: string | undefined;
  export const AUTH_SCOPES: string | undefined;
  export const PREMIUM_OCR_ENDPOINT: string | undefined;
  export const FEATURE_PREMIUM_OCR: string | undefined;
}
