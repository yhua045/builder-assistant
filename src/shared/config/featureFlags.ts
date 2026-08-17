/**
 * Feature Flags
 *
 * Runtime feature gates. Set via `.env` (react-native-config) for production
 * or `process.env` when running under Jest / Metro.
 *
 * To enable AI suggestions locally:
 *   FEATURE_AI_SUGGESTIONS=true npx react-native start
 */
declare const process: any;

/**
 * When true, the AI suggestion area is rendered in TaskBottomSheet and
 * useTaskDetail will call SuggestionService.
 *
 * Defaults to false — stub produces no suggestions and the UI panel is hidden.
 */
export const FEATURE_AI_SUGGESTIONS: boolean =
  (process?.env?.FEATURE_AI_SUGGESTIONS ?? '') === 'true';
