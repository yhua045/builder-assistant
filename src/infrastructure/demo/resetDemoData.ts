/**
 * Demo data reset function.
 * Safely deletes all demo rows (identified by `demo_` prefix in IDs)
 * in reverse foreign-key order to avoid constraint violations.
 */

import { getDatabase } from '../database/connection';
import {
  taskDelayReasons,
  taskDependencies,
  documents,
  tasks,
  projects,
  properties,
  contacts,
} from '../database/schema';
import { like } from 'drizzle-orm';

export async function resetDemoData(): Promise<void> {
  try {
    const { drizzle: db } = getDatabase();

    console.log('[reset] Clearing demo data...');

    // Delete in reverse foreign-key order to avoid constraint violations
    const delayCount = await db.delete(taskDelayReasons).where(like(taskDelayReasons.id, 'demo_%'));
    console.log('[reset] ✓ Cleared task delay reasons');

    const depsCount = await db.delete(taskDependencies).where(like(taskDependencies.taskId, 'demo_%'));
    console.log('[reset] ✓ Cleared task dependencies');

    const docsCount = await db.delete(documents).where(like(documents.id, 'demo_%'));
    console.log('[reset] ✓ Cleared documents');

    const tasksCount = await db.delete(tasks).where(like(tasks.id, 'demo_%'));
    console.log('[reset] ✓ Cleared tasks');

    const projectsCount = await db.delete(projects).where(like(projects.id, 'demo_%'));
    console.log('[reset] ✓ Cleared projects');

    const propertiesCount = await db.delete(properties).where(like(properties.id, 'demo_%'));
    console.log('[reset] ✓ Cleared properties');

    const contactsCount = await db.delete(contacts).where(like(contacts.id, 'demo_%'));
    console.log('[reset] ✓ Cleared contacts');

    console.log('[reset] ✅ Demo data cleared successfully!');
  } catch (error) {
    console.error('[reset] ❌ Error resetting demo data:', error);
    throw error;
  }
}
