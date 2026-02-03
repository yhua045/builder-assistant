import { drizzle } from 'drizzle-orm/sqlite-proxy';
import SQLite from 'react-native-sqlite-storage';
import { migrate } from 'drizzle-orm/sqlite-proxy/migrator';
import * as schema from './schema';

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

    // Run migrations from the migrations folder
    await migrate(
      drizzle,
      async (queries) => {
        for (const query of queries) {
          await db.executeSql(query);
        }
      },
      { migrationsFolder: './drizzle/migrations' }
    );

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
