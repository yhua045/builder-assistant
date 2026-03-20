/**
 * Lookup registry — maps "<state>/<project_type>" keys to their JSON lookup files.
 *
 * Metro (React Native bundler) requires static `require()` calls so that assets
 * are included in the bundle at build time. Do NOT use dynamic require().
 *
 * To add a new lookup file:
 * 1. Create the JSON file in the appropriate state folder (see README.md).
 * 2. Add the key and require() call to LOOKUP_REGISTRY below.
 * 3. Run `npx tsc --noEmit` to confirm typings are happy.
 */

import type { CriticalPathLookupFile } from './schema';

const LOOKUP_REGISTRY: Record<string, CriticalPathLookupFile> = {
  'National/complete_rebuild': require('./National/complete_rebuild.json') as CriticalPathLookupFile,
  'National/extension': require('./National/extension.json') as CriticalPathLookupFile,
  'National/renovation': require('./National/renovation.json') as CriticalPathLookupFile,
  'NSW/complete_rebuild': require('./NSW/complete_rebuild.json') as CriticalPathLookupFile,
  'NSW/extension': require('./NSW/extension.json') as CriticalPathLookupFile,
};

/**
 * Returns the lookup file for the given key, or `undefined` if not found.
 * The registry contains only statically-bundled files (Metro require).
 */
export function getLookupFile(key: string): CriticalPathLookupFile | undefined {
  return LOOKUP_REGISTRY[key];
}

/** All registered lookup keys — useful for validation and testing. */
export const REGISTERED_KEYS = Object.keys(LOOKUP_REGISTRY);
