/**
 * Demo data seeder for Task Cockpit & Bottom Sheet features.
 * This function seeds the SQLite database with representative test scenarios
 * when SEED_DEMO_DATA env var is true (on app startup in dev).
 *
 * Idempotent: skips if demo project already exists.
 */

import { getDatabase } from '../database/connection';
import {
  contacts,
  properties,
  projects,
  tasks,
  taskDependencies,
  taskDelayReasons,
  documents,
  invoices,
  payments,
} from '../database/schema';
import { eq } from 'drizzle-orm';
import { DEMO_FIXTURES, DEMO_PROJECT_ID } from './demoFixtures';

export async function seedDemoData(): Promise<void> {
  try {
    const { drizzle: db } = getDatabase();

    // Idempotency guard: check if demo project already exists
    const existing = await db.select().from(projects).where(eq(projects.id, DEMO_PROJECT_ID));
    if (existing && existing.length > 0) {
      console.log('[seed] Demo data already present — skipping.');
      return;
    }

    console.log('[seed] Inserting demo data...');

    // Insert in foreign-key order to avoid constraint violations
    await db.insert(contacts).values(DEMO_FIXTURES.contacts);
    console.log(`[seed] ✓ Inserted ${DEMO_FIXTURES.contacts.length} contacts`);

    await db.insert(properties).values([DEMO_FIXTURES.property]);
    console.log('[seed] ✓ Inserted property');

    await db.insert(projects).values([DEMO_FIXTURES.project]);
    console.log('[seed] ✓ Inserted project');

    await db.insert(tasks).values(DEMO_FIXTURES.tasks);
    console.log(`[seed] ✓ Inserted ${DEMO_FIXTURES.tasks.length} tasks`);

    await db.insert(taskDependencies).values(DEMO_FIXTURES.dependencies);
    console.log(`[seed] ✓ Inserted ${DEMO_FIXTURES.dependencies.length} task dependencies`);

    await db.insert(taskDelayReasons).values(DEMO_FIXTURES.delayReasons);
    console.log(`[seed] ✓ Inserted ${DEMO_FIXTURES.delayReasons.length} delay reasons`);

    await db.insert(documents).values(DEMO_FIXTURES.documents);
    console.log(`[seed] ✓ Inserted ${DEMO_FIXTURES.documents.length} documents`);

    await db.insert(invoices).values(DEMO_FIXTURES.invoices);
    console.log(`[seed] ✓ Inserted ${DEMO_FIXTURES.invoices.length} invoices`);

    await db.insert(payments).values(DEMO_FIXTURES.payments);
    console.log(`[seed] ✓ Inserted ${DEMO_FIXTURES.payments.length} payments`);

    console.log('[seed] ✅ Demo data seeded successfully!');
  } catch (error) {
    console.error('[seed] ❌ Error seeding demo data:', error);
    throw error;
  }
}
