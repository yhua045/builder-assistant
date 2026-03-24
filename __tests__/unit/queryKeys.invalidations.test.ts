/**
 * Unit tests for the invalidations map in queryKeys.ts
 *
 * These tests assert that every invalidation helper that can affect
 * project-level financial totals (pending payments, overview status)
 * includes queryKeys.projectsOverview() in its returned key set.
 *
 * Issue #172: Project Card ↔ Task Detail Sync
 */

import { invalidations, queryKeys } from '../../src/hooks/queryKeys';

const PROJECTS_OVERVIEW_KEY = queryKeys.projectsOverview();

/**
 * Helper: true if the returned key array contains projectsOverview.
 */
function includesProjectsOverview(keys: readonly (readonly string[])[]): boolean {
  return keys.some(
    k => JSON.stringify(k) === JSON.stringify(PROJECTS_OVERVIEW_KEY),
  );
}

describe('invalidations — projectsOverview coverage', () => {
  // ── Already-correct entries (regression guard) ─────────────────────────────

  it('taskEdited includes projectsOverview', () => {
    const keys = invalidations.taskEdited({ projectId: 'p1', taskId: 't1' });
    expect(includesProjectsOverview(keys)).toBe(true);
  });

  // ── Issue #172 fixes ───────────────────────────────────────────────────────

  it('invoiceMutated with projectId includes projectsOverview', () => {
    const keys = invalidations.invoiceMutated({ projectId: 'p1' });
    expect(includesProjectsOverview(keys)).toBe(true);
  });

  it('invoiceMutated with taskId only (no projectId) includes projectsOverview', () => {
    const keys = invalidations.invoiceMutated({ taskId: 't1' });
    expect(includesProjectsOverview(keys)).toBe(true);
  });

  it('invoiceMutated with no context still includes projectsOverview', () => {
    const keys = invalidations.invoiceMutated({});
    expect(includesProjectsOverview(keys)).toBe(true);
  });

  it('paymentRecorded with projectId includes projectsOverview', () => {
    const keys = invalidations.paymentRecorded({ projectId: 'p1' });
    expect(includesProjectsOverview(keys)).toBe(true);
  });

  it('paymentRecorded with empty context includes projectsOverview', () => {
    const keys = invalidations.paymentRecorded({});
    expect(includesProjectsOverview(keys)).toBe(true);
  });
});
