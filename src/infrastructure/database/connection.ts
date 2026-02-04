import { drizzle } from 'drizzle-orm/sqlite-proxy';
import SQLite from 'react-native-sqlite-storage';
import * as schema from './schema';
import { getBundledMigrations } from './migrations';

SQLite.enablePromise(true);

let dbInstance: SQLite.SQLiteDatabase | null = null;
let drizzleInstance: ReturnType<typeof drizzle> | null = null;

/**
 * Initialize the database connection and run migrations
 */
export async function initDatabase() {
  if (dbInstance && drizzleInstance) {
    return { db: dbInstance, drizzle: drizzleInstance };
  }

  // Open SQLite database
  dbInstance = await SQLite.openDatabase({
    name: 'builder_assistant.db',
    location: 'default',
  });

  // Create Drizzle instance with proxy
  drizzleInstance = drizzle(async (sql, params, method) => {
    try {
      if (method === 'run' || method === 'all' || method === 'get') {
        const [results] = await dbInstance!.executeSql(sql, params);
        
        if (method === 'all') {
          const rows: any[] = [];
          for (let i = 0; i < results.rows.length; i++) {
            rows.push(results.rows.item(i));
          }
          return { rows };
        }
        
        if (method === 'get') {
          return { rows: results.rows.length > 0 ? [results.rows.item(0)] : [] };
        }
        
        return { rows: [] };
      }
      
      throw new Error(`Unsupported method: ${method}`);
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  }, { schema });

  // Run migrations
  await runMigrations(drizzleInstance, dbInstance);

  return { db: dbInstance, drizzle: drizzleInstance };
}

/**
 * Run all pending migrations
 */
async function runMigrations(
  drizzle: ReturnType<typeof import('drizzle-orm/sqlite-proxy').drizzle>,
  db: SQLite.SQLiteDatabase
) {
  try {
    console.log('Running database migrations...');
    
    // Create migrations table if it doesn't exist
    await db.executeSql(`
      CREATE TABLE IF NOT EXISTS __drizzle_migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hash TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `);

    const migrations = getBundledMigrations();

    const [existing] = await db.executeSql(
      'SELECT hash FROM __drizzle_migrations'
    );
    const applied = new Set<string>();
    for (let i = 0; i < existing.rows.length; i++) {
      applied.add(existing.rows.item(i).hash);
    }

    for (const migration of migrations) {
      if (applied.has(migration.hash)) continue;
      for (const query of migration.sql) {
        await db.executeSql(query);
      }
      await db.executeSql(
        'INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)',
        [migration.hash, migration.folderMillis]
      );
    }

    console.log('Migrations completed successfully');
  } catch (error) {
    console.error('Migration error:', error);
    throw error;
  }
}

/**
 * Get the current database instance
 */
export function getDatabase() {
  if (!dbInstance || !drizzleInstance) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return { db: dbInstance, drizzle: drizzleInstance };
}

/**
 * Close the database connection
 */
export async function closeDatabase() {
  if (dbInstance) {
    await dbInstance.close();
    dbInstance = null;
    drizzleInstance = null;
  }
}
