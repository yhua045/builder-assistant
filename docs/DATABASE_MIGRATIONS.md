# Database Migration Guide with Drizzle ORM

## Overview

This project uses **Drizzle ORM** for database schema management and migrations. Drizzle provides TypeScript-first schema definitions with automatic migration generation.

## Key Components

1. **Schema Definition**: [src/infrastructure/database/schema.ts](src/infrastructure/database/schema.ts)
2. **Database Connection**: [src/infrastructure/database/connection.ts](src/infrastructure/database/connection.ts)
3. **Migrations Folder**: `drizzle/migrations/`
4. **Configuration**: [drizzle.config.ts](drizzle.config.ts)

## Common Workflows

### 1. Making Schema Changes

Edit the schema in TypeScript:

```typescript
// src/infrastructure/database/schema.ts
export const projects = sqliteTable('projects', {
  localId: integer('local_id').primaryKey({ autoIncrement: true }),
  id: text('id').notNull().unique(),
  name: text('name').notNull(),
  // Add new field
  priority: text('priority', { enum: ['low', 'medium', 'high'] }),
  // ... other fields
});
```

### 2. Generate Migration

After changing the schema, generate a migration:

```bash
npm run db:generate
```

This creates a new SQL file in `drizzle/migrations/` like `0001_add_priority.sql`.

### 3. Apply Migrations

Migrations are automatically applied when the app starts via `initDatabase()`. The migration system:
- Tracks applied migrations in `__drizzle_migrations` table
- Only runs new migrations
- Runs migrations in order

### 4. Development Commands

```bash
# Generate migration from schema changes
npm run db:generate

# Push schema changes directly (dev only, skips migrations)
npm run db:push

# Open Drizzle Studio to view/edit data
npm run db:studio

# Check for schema drift
npm run db:check
```

## Migration Examples

### Adding a New Column

**1. Update schema.ts:**
```typescript
export const projects = sqliteTable('projects', {
  // ... existing fields
  estimatedHours: real('estimated_hours'),
});
```

**2. Generate migration:**
```bash
npm run db:generate
```

**3. Generated SQL:**
```sql
ALTER TABLE projects ADD COLUMN estimated_hours REAL;
```

### Adding a New Table

**1. Update schema.ts:**
```typescript
export const projectNotes = sqliteTable('project_notes', {
  localId: integer('local_id').primaryKey({ autoIncrement: true }),
  id: text('id').notNull().unique(),
  projectId: text('project_id').notNull(),
  content: text('content').notNull(),
  createdAt: integer('created_at'),
});
```

**2. Generate migration:**
```bash
npm run db:generate
```

### Renaming a Column

Drizzle doesn't auto-detect renames. You need to:

**1. Create a custom migration:**
```sql
-- drizzle/migrations/0002_rename_column.sql
ALTER TABLE projects RENAME COLUMN old_name TO new_name;
```

**2. Update schema.ts** to match.

## Best Practices

### ✅ Do:
- Always generate migrations for production changes
- Test migrations on a copy of production data
- Use TypeScript schema as source of truth
- Run `npm run db:check` before deploying

### ❌ Don't:
- Don't use `db:push` in production (it bypasses migrations)
- Don't manually edit generated migration files (create new ones instead)
- Don't delete old migrations that have been applied

## Troubleshooting

### Migration fails on app start

Check the error in the console. Common issues:
- SQL syntax error in migration file
- Constraint violation (e.g., adding NOT NULL without default)
- Foreign key constraint violation

### Schema drift detected

If you've manually modified the database:
```bash
npm run db:check
```

To fix, either:
1. Generate a new migration: `npm run db:generate`
2. Or reset dev database and regenerate from schema

### Reset database (development only)

```typescript
// In your app
import { closeDatabase } from './src/infrastructure/database/connection';
import SQLite from 'react-native-sqlite-storage';

await closeDatabase();
await SQLite.deleteDatabase({ name: 'builder_assistant.db', location: 'default' });
// Restart app to regenerate from schema
```

## Switching from Old Repository

To migrate from `LocalSqliteProjectRepository` to `DrizzleProjectRepository`:

```typescript
// Old
import { LocalSqliteProjectRepository } from './infrastructure/repositories/LocalSqliteProjectRepository';
const repo = new LocalSqliteProjectRepository();

// New
import { DrizzleProjectRepository } from './infrastructure/repositories/DrizzleProjectRepository';
const repo = new DrizzleProjectRepository();
```

Both implement the same `ProjectRepository` interface, so usage is identical.

## Resources

- [Drizzle ORM Docs](https://orm.drizzle.team/)
- [SQLite Migrations](https://orm.drizzle.team/docs/migrations)
- [Drizzle with React Native](https://orm.drizzle.team/docs/get-started-sqlite#react-native)
