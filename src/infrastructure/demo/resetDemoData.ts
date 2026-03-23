/**
 * Data reset function.
 * Deletes ALL rows from all tables in reverse foreign-key order
 * to avoid constraint violations.
 */

import { getDatabase } from '../database/connection';
import {
  taskDelayReasons,
  taskDependencies,
  documents,
  payments,
  invoices,
  quotations,
  tasks,
  projects,
  properties,
  contacts,
} from '../database/schema';

export async function resetDemoData(): Promise<void> {
  try {
    const { drizzle: db } = getDatabase();

    console.log('[reset] Clearing all data...');

    // Delete in reverse foreign-key order to avoid constraint violations
    await db.delete(taskDelayReasons);
    console.log('[reset] ✓ Cleared task delay reasons');

    await db.delete(taskDependencies);
    console.log('[reset] ✓ Cleared task dependencies');

    await db.delete(documents);
    console.log('[reset] ✓ Cleared documents');

    await db.delete(payments);
    console.log('[reset] ✓ Cleared payments');

    await db.delete(invoices);
    console.log('[reset] ✓ Cleared invoices');

    await db.delete(quotations);
    console.log('[reset] ✓ Cleared quotations');

    await db.delete(tasks);
    console.log('[reset] ✓ Cleared tasks');

    await db.delete(projects);
    console.log('[reset] ✓ Cleared projects');

    await db.delete(properties);
    console.log('[reset] ✓ Cleared properties');

    await db.delete(contacts);
    console.log('[reset] ✓ Cleared contacts');

    console.log('[reset] ✅ All data cleared successfully!');
  } catch (error) {
    console.error('[reset] ❌ Error resetting demo data:', error);
    throw error;
  }
}
