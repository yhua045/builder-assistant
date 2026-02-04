# Drizzle ORM Integration Summary

## What Was Set Up

Drizzle ORM has been successfully integrated into your Builder Assistant app for managing database schema and migrations.

### Files Created

1. **[drizzle.config.ts](drizzle.config.ts)** - Drizzle configuration
2. **[src/infrastructure/database/schema.ts](src/infrastructure/database/schema.ts)** - TypeScript schema definition (converted from SQL)
3. **[src/infrastructure/database/connection.ts](src/infrastructure/database/connection.ts)** - Database initialization with migration support
4. **[src/infrastructure/repositories/DrizzleProjectRepository.ts](src/infrastructure/repositories/DrizzleProjectRepository.ts)** - Example repository using Drizzle
5. **[docs/DATABASE_MIGRATIONS.md](docs/DATABASE_MIGRATIONS.md)** - Complete migration guide
6. **[drizzle/migrations/0000_slow_drax.sql](drizzle/migrations/0000_slow_drax.sql)** - Initial migration (auto-generated)

### NPM Scripts Added

```json
{
  "db:generate": "drizzle-kit generate",  // Generate migration from schema changes
  "db:push": "drizzle-kit push",          // Push schema directly (dev only)
  "db:studio": "drizzle-kit studio",      // Open visual database editor
  "db:check": "drizzle-kit check"         // Check for schema drift
}
```

## How It Works

### 1. Schema Definition (TypeScript)

Instead of writing SQL, you define your schema in TypeScript:

```typescript
export const projects = sqliteTable('projects', {
  localId: integer('local_id').primaryKey({ autoIncrement: true }),
  id: text('id').notNull().unique(),
  name: text('name').notNull(),
  status: text('status', { 
    enum: ['planning', 'in_progress', 'on_hold', 'completed', 'cancelled'] 
  }).notNull(),
});
```

### 2. Automatic Migration Generation

When you change the schema, run:
```bash
npm run db:generate
```

This creates a SQL migration file like:
```sql
ALTER TABLE projects ADD COLUMN new_field TEXT;
```

### 3. Migrations Run Automatically

When your app starts, it:
1. Connects to SQLite
2. Checks which migrations have been applied
3. Runs any new migrations
4. Tracks them in `__drizzle_migrations` table

### React Native (Bundled Migrations)

React Native cannot load SQL files from disk at runtime (no `node:fs`).
For RN builds, migrations are bundled into a JS registry and applied programmatically.

**Bundled file:** `src/infrastructure/database/migrations.ts`

#### Update Workflow (RN)

After generating a new migration, update the bundled registry:

1. Generate SQL migrations as usual
```bash
npm run db:generate
```

2. Copy the contents of the new SQL migration file from `drizzle/migrations/` into
`src/infrastructure/database/migrations.ts` and append a new entry to the `migrations` array.

3. Restart the app (or rebuild) to apply the new migration on launch.

#### Example (Bundled Entry)

```ts
const rawMigration0001 = `... SQL ...`;

const migrations: RNMigration[] = [
  // existing entries...
  {
    tag: '0001_add_new_field',
    hash: '0001_add_new_field',
    folderMillis: 1770083691891,
    sql: rawMigration0001
      .split('--> statement-breakpoint')
      .map((statement) => statement.trim())
      .filter(Boolean),
  },
];
```

> Tip: This can be automated with a small script if desired.

## Migration Workflow Example

### Adding a New Field

**Step 1:** Edit [src/infrastructure/database/schema.ts](src/infrastructure/database/schema.ts)
```typescript
export const projects = sqliteTable('projects', {
  // ... existing fields
  priority: text('priority', { enum: ['low', 'medium', 'high'] }), // NEW
});
```

**Step 2:** Generate migration
```bash
npm run db:generate
```

**Step 3:** App automatically applies migration on next start

### Adding a New Table

**Step 1:** Add to schema.ts
```typescript
export const projectNotes = sqliteTable('project_notes', {
  localId: integer('local_id').primaryKey({ autoIncrement: true }),
  id: text('id').notNull().unique(),
  projectId: text('project_id').notNull(),
  content: text('content').notNull(),
});
```

**Step 2:** Generate & apply
```bash
npm run db:generate
# Restart app to apply
```

## Key Benefits

✅ **Type Safety** - Schema is TypeScript, not SQL  
✅ **Auto Migration** - Drizzle generates SQL for you  
✅ **Version Control** - Migrations are tracked and versioned  
✅ **No Manual SQL** - Define schema once, migrations auto-generated  
✅ **Rollback Support** - Can revert migrations if needed  

## Using Drizzle in Your Code

### Option 1: Use DrizzleProjectRepository (new)

```typescript
import { DrizzleProjectRepository } from './infrastructure/repositories/DrizzleProjectRepository';

const repo = new DrizzleProjectRepository();
await repo.init(); // Runs migrations automatically
const projects = await repo.findAll();
```

### Option 2: Keep Using LocalSqliteProjectRepository (existing)

Your existing code continues to work as-is. The migration system works alongside it.

### Option 3: Direct Drizzle Queries

```typescript
import { initDatabase } from './infrastructure/database/connection';
import * as schema from './infrastructure/database/schema';

const { drizzle } = await initDatabase();
const projects = await drizzle.select().from(schema.projects);
```

## Next Steps

1. **Test migrations** - Run your app to ensure the initial migration works
2. **Make a schema change** - Try adding a field and generating a migration
3. **Read the guide** - See [docs/DATABASE_MIGRATIONS.md](docs/DATABASE_MIGRATIONS.md) for more examples

## Troubleshooting

- **Migrations fail?** Check console logs for SQL errors
- **Schema drift?** Run `npm run db:check`
- **Need to reset?** Delete the app's database and restart (dev only)

## Resources

- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [Migration Guide](docs/DATABASE_MIGRATIONS.md)
- [SQLite with Drizzle](https://orm.drizzle.team/docs/get-started-sqlite)
