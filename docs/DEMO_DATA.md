# Demo Data Guide

This guide explains how to seed and reset demo data for testing the Task Cockpit and Bottom Sheet features.

## Overview

The demo data generator populates the SQLite database with 37 representative test scenarios covering:

- **Blocker Chain**: Tasks showing blocking dependencies and overdue alerts
- **Focus-3**: Critical-path task ranking with urgency indicators
- **Bottom Sheet**: Prerequisites and next-in-line task context
- **Quick Actions**: Photo attachments and subcontractor contact information
- **Mixed Portfolio**: Completed, cancelled, and unblocked tasks for UI resilience testing

All demo data uses a `demo_` prefix in IDs for easy identification and cleanup.

## Quick Start

### Seed Demo Data on iOS Simulator

```bash
npm run seed:demo
```

This command:
1. Sets `SEED_DEMO_DATA=true`
2. Launches the iOS simulator
3. Initializes the database
4. Seeds the demo project with 20 tasks and related data

**Idempotency**: If demo data already exists (detected by checking for the demo project), seeding is skipped. Safe to run multiple times.

### Seed Demo Data on Android Emulator

```bash
npm run seed:demo:android
```

Same as iOS, but targets Android emulator.

### Reset and Re-seed

To wipe all demo data and start fresh:

```bash
npm run seed:reset      # iOS
npm run seed:reset:android  # Android
```

This command:
1. Sets `RESET_DEMO_DATA=true`
2. Deletes all rows with `demo_` prefix IDs
3. Launches the simulator
4. Re-seeds all demo data from scratch

## Manual Seeding via Environment File

If you prefer to use an `.env` file instead of the command-line flag:

1. **Create or edit `.env.demo`**:
   ```
   SEED_DEMO_DATA=true
   ```

2. **Copy to `.env`** (if not already using it):
   ```bash
   cp .env.demo .env
   ```

3. **Start the app**:
   ```bash
   npm run ios
   ```

The `react-native-config` library will read the env vars and pass them to the JS bundle.

## Validating the Seed

Once the app launches, check the console logs:

```
[seed] Inserting demo data...
[seed] ✓ Inserted 4 contacts
[seed] ✓ Inserted property
[seed] ✓ Inserted project
[seed] ✓ Inserted 20 tasks
[seed] ✓ Inserted 8 task dependencies
[seed] ✓ Inserted 1 delay reasons
[seed] ✓ Inserted 2 documents
[seed] ✅ Demo data seeded successfully!
```

Then navigate to the **Tasks** screen. You should see:

- **Blocker Bar** (carousel at top): Two blocked tasks showing red/yellow severity badges
  - 🔴 External Cladding (overdue 3 days)
  - 🔴 Scaffold Assembly (overdue 1 day, waiting on first task)

- **Focus-3 List** (below blocker bar): Three ranked critical-path tasks
  - #1 Frame Roof Plates — 🔴 3d overdue
  - #2 Window & Door Rough-In — 🟡 Due today
  - #3 Roof Batten Install — 🟢 5d left

- **Task List** (below focus): All 20 tasks visible, filterable by status

### Testing Quick Actions

1. Tap on a blocked task in the BlockerBar (e.g., "External Cladding")
2. A **Bottom Sheet** slides up showing:
   - Task status/priority (tap to change)
   - **Prerequisites**: Concrete Slab Pour (✅ completed)
   - **Next-In-Line**: Tile Laying, Paint Works (↳ waiting on this task)
   - **Quick Actions**:
     -  ⚠️ Mark as Blocked
     -  📋 See Full Details
     -  (when available: 📷 Upload Photo, ☎️ Call Subcontractor)

### Testing Document Attachments

1. Open the task **"Site Safety Inspection"** (demo_task_t11)
2. In the Bottom Sheet or full details page, you should see **2 sample photos**:
   - "Scaffold base anchor check"
   - "Safety net inspection front"
3. Tap "📷 Upload Photo" flow to test the quick action

## Advanced: Manual Reset Without Re-seeding

If you want to delete demo data without re-seeding:

1. Open **Drizzle Studio**:
   ```bash
   npm run db:studio
   ```

2. In the browser UI, manually delete rows where `id` starts with `demo_`

3. Or use the app's reset flow:
   ```bash
   RESET_DEMO_DATA=true npm run ios
   ```

## Troubleshooting

### "Demo data already present — skipping"

The seeder detected existing demo data and skipped insertion (idempotency). To force a re-seed:

```bash
npm run seed:reset
```

### "Database not initialized. Call initDatabase() first"

The database initialization failed. Check:
1. Drizzle migrations are being applied (look for migration logs)
2. SQLite permissions are correct on the simulator/device
3. Try restarting the simulator: `npm run ios -- --recycle`

### Fixture images not showing

The sample photos are placeholder JPEGs stored at `assets/demo/photo_*.jpg`. If they're not visible:

1. Verify the files exist:
   ```bash
   ls -l assets/demo/
   ```

2. Rebuild the Metro bundler cache:
   ```bash
   npm start -- --reset-cache
   ```

3. Re-run the app

### Demo data visible but Cockpit/Focus lists are empty

The cockpit scorer requires tasks with:
- Dependencies (task_dependencies rows)
- Status (pending/in_progress/blocked)
- Due dates (for urgency calculation)

The seeded data includes all of these. If lists are still empty:

1. Check the app console for `GetCockpitDataUseCase` errors
2. Verify task rows were inserted: `npm run db:studio`
3. Try resetting: `npm run seed:reset`

## Data Snapshot

The demo dataset includes:

| Entity | Count | Notes |
|---|---|---|
| Contacts | 4 | Demo Owner, Jake (scaffolding), Maria (painter), Tom (builder) |
| Properties | 1 | Kellyville, NSW — 42 Greenwood Drive |
| Projects | 1 | "Greenwood Residential Extension" (in_progress) |
| Tasks | 20 | Covering all 5 scenarios (blockers, focus, bottom sheet, etc.) |
| Task Dependencies | 8 | Chains: Foundation → Blocker → Next-In-Line |
| Delay Reasons | 1 | Material delivery delay on External Cladding task |
| Documents | 2 | Sample photo fixtures for quick actions |

## Next Steps

Once demo data is seeded and validated:

1. **Explore Blocker Bar**: Tap cards to open Bottom Sheet
2. **Test Focus-3 Ranking**: Check urgency labels update with time
3. **Quick Actions**: Try "Mark as Blocked", "Call Subcontractor", "Upload Photo"
4. **Filter Tasks**: Use status/priority pills to filter the task list
5. **Task Details**: Open full task page to see dependencies, delay log, documents

## Questions?

If the demo data doesn't work as expected:

1. Check the browser console for errors
2. Review [design/issue-121-demo-data.md](../design/issue-121-demo-data.md) for technical details
3. Verify `.env.demo` or command-line env vars are being read by Config
