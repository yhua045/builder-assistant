# Database Migrations with Drizzle ORM

## Technology Stack

- **ORM**: Drizzle ORM v0.45.1
- **Database**: SQLite (react-native-sqlite-storage)
- **Migration Tool**: drizzle-kit v0.31.8
- **Platform**: React Native with Expo driver

## Configuration

**Location**: `drizzle.config.ts`
```typescript
export default {
  schema: './src/infrastructure/database/schema.ts',
  out: './drizzle/migrations',
  dialect: 'sqlite',
  driver: 'expo',
};
```

**Schema Location**: `src/infrastructure/database/schema.ts`
- TypeScript-first schema definitions
- All table definitions and relationships

## Migration Workflow

### 1. Schema Changes

Edit `src/infrastructure/database/schema.ts` to modify tables, columns, or indexes.

### 2. Generate Migration

```bash
npm run db:generate
```

This creates:
- SQL migration file in `drizzle/migrations/` (e.g., `0001_add_column.sql`)
- Updated `drizzle/migrations/migrations.js` which imports the SQL files

### 3. Update App Migrations

**CRITICAL STEP**: The app uses a manual migration file because React Native Metro bundler doesn't support importing `.sql` files directly by default.

Open `src/infrastructure/database/migrations.ts` and add the new migration manually:

1. Copy the content of the generated `.sql` file in `drizzle/migrations/`
2. Add a new entry to the `migrations` array:
   ```typescript
   {
     tag: '000X_migration_name',
     hash: '000X_migration_name', // Use the tag as hash for simplicity
     folderMillis: Date.now(), // Use current timestamp
     sql: [
       // Paste SQL content here nicely formatted as strings
       // Split by '--> statement-breakpoint' if needed
     ],
   }
   ```
3. Update imports if you prefer importing raw strings (optional but cleaner)

### 4. Migration Execution

**Automatic**: Migrations run automatically on app startup via `initDatabase()` in `src/infrastructure/database/connection.ts`

**Process**:
- Checks `__drizzle_migrations` table for applied migrations
- Executes new migrations in order
- Records completion in migration table

## Development Commands

```bash
# Generate migration from schema changes
npm run db:generate

# Push schema directly (development only - bypasses migrations)
npm run db:push

# Open Drizzle Studio for data inspection
npm run db:studio

# Check for schema drift
npm run db:check
```

## Production Deployment

1. **Generate migrations** in development
2. **Commit migration files** to version control
3. **Deploy app** - migrations run automatically on first startup
4. **No manual intervention** required

## Migration Files Structure

```
drizzle/migrations/
├── 0000_initial.sql          # Initial schema
├── 0001_add_column.sql       # Generated migration
├── migrations.js             # Bundled for React Native
└── meta/
    ├── _journal.json         # Migration tracking
    └── 0000_snapshot.json    # Schema snapshot
```

## Best Practices

- ✅ Always use `db:generate` for production changes
- ✅ Test migrations on development data before deploying
- ✅ Never use `db:push` in production
- ✅ Keep migration files in version control
- ✅ Run `db:check` before deploying

## Troubleshooting

**Migration fails on startup**:
- Check console for SQL syntax errors
- Verify column constraints (NOT NULL without defaults)
- Ensure foreign key relationships exist

**Schema drift detected**:
```bash
npm run db:check
```
Fix by generating new migration or resetting dev database.

**Reset development database**:
```typescript
import { closeDatabase } from './src/infrastructure/database/connection';
await closeDatabase();
// Delete database file and restart app
```
