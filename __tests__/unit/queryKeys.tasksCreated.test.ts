/**
 * Unit tests for the tasksCreated invalidation in queryKeys.ts
 * Issue #203: Tasks screen refresh — tasksCreated must bust the global (unscoped) key
 */

import { invalidations, queryKeys } from '../../src/hooks/queryKeys';

describe('invalidations.tasksCreated', () => {
  const projectId = 'proj-abc';

  it('includes the project-scoped tasks key', () => {
    const keys = invalidations.tasksCreated({ projectId });
    const expectedKey = JSON.stringify(queryKeys.tasks(projectId));
    expect(keys.map((k) => JSON.stringify(k))).toContain(expectedKey);
  });

  it('includes the global (unscoped) tasks key', () => {
    const keys = invalidations.tasksCreated({ projectId });
    const expectedKey = JSON.stringify(queryKeys.tasks());
    expect(keys.map((k) => JSON.stringify(k))).toContain(expectedKey);
  });

  it('includes projectsOverview key', () => {
    const keys = invalidations.tasksCreated({ projectId });
    const expectedKey = JSON.stringify(queryKeys.projectsOverview());
    expect(keys.map((k) => JSON.stringify(k))).toContain(expectedKey);
  });
});
