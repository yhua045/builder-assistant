# Design: Issue #121 — Demo Data Generator for Task Cockpit & Bottom Sheet

**Status**: PLANNING  
**Author**: Copilot  
**Date**: 2026-03-06  
**GitHub Issue**: https://github.com/yhua045/builder-assistant/issues/121  
**Related Designs**:
- [design/issue-116-task-cockpit.md](issue-116-task-cockpit.md)
- [design/issue-118-task-bottomsheet.md](issue-118-task-bottomsheet.md)

---

## 0. Purpose

Document the proposed demo dataset and execution model for a seed script that
populates the Task Cockpit and Bottom Sheet features with representative data
for tester/stakeholder validation — without manual setup.

> **No TDD for this task.** No tests are required. The seed function is development
> infrastructure, not production business logic.

---

## 1. Execution Model (React Native Constraint)

The app's live database is a **SQLite file on the iOS/Android simulator**.  
Node.js scripts cannot write to it directly. The seed function must run
**inside the React Native runtime** using the same Drizzle `db` instance the
app itself uses.

### Chosen Approach: Startup Env-Flag Trigger

```
SEED_DEMO_DATA=true npm run ios     ← seeds on first cold start
RESET_DEMO_DATA=true npm run ios    ← wipes demo rows then re-seeds
```

**Boot flow** (added to `src/infrastructure/database/connection.ts` or `App.tsx`
`__DEV__` guard):

```
1. initDatabase()  (existing migrations run)
2. if (__DEV__ && process.env.SEED_DEMO_DATA === 'true')
       await seedDemoData(db)        ← idempotent — skips if project already exists
3. if (__DEV__ && process.env.RESET_DEMO_DATA === 'true')
       await resetDemoData(db)
       await seedDemoData(db)
```

`react-native-config` (already in the project for Groq keys) exposes the env var
to the JS bundle.

### `package.json` Commands

```json
"seed:demo":  "SEED_DEMO_DATA=true npm run ios",
"seed:reset": "RESET_DEMO_DATA=true npm run ios",
"seed:demo:android":  "SEED_DEMO_DATA=true npm run android",
"seed:reset:android": "RESET_DEMO_DATA=true npm run android"
```

### File Locations

| File | Purpose |
|---|---|
| `src/infrastructure/demo/seedDemoData.ts` | Main seeder — inserts all demo rows |
| `src/infrastructure/demo/resetDemoData.ts` | Wiper — deletes rows by `DEMO_PROJECT_ID` |
| `src/infrastructure/demo/demoFixtures.ts` | Plain-data constants (IDs, dates, strings) |
| `assets/demo/photo_scaffold.jpg` | Sample fixture image 1 (~12 KB JPEG) |
| `assets/demo/photo_safety_net.jpg` | Sample fixture image 2 (~12 KB JPEG) |
| `docs/DEMO_DATA.md` | Run/reset instructions for testers |

---

## 2. Idempotency Guard

The seeder checks for the presence of the demo project before inserting:

```ts
const existing = await db.select().from(projects)
  .where(eq(projects.id, DEMO_PROJECT_ID));
if (existing.length > 0) {
  console.log('[seed] Demo data already present — skipping.');
  return;
}
```

`resetDemoData` deletes in dependency order (delay reasons → task deps →
documents → tasks → contacts → project phases → project → property) then returns.

---

## 3. Proposed Demo Dataset

All IDs use a `demo_` prefix to clearly distinguish from real user data.  
All timestamps are expressed relative to the **day the seed runs** (Date.now()).

### 3.1 Contact Records (`contacts` table)

| Alias | `id` | `name` | `roles` | `trade` | `phone` |
|---|---|---|---|---|---|
| Owner | `demo_contact_owner` | Demo Owner | `["owner"]` | — | 0400 000 000 |
| Jake (scaffolding) | `demo_contact_jake` | Jake Conlon | `["subcontractor"]` | Scaffolding | 0412 000 001 |
| Maria (painter) | `demo_contact_maria` | Maria Silva | `["subcontractor"]` | Painting & Interiors | 0412 000 002 |
| Tom (builder) | `demo_contact_tom` | Tom O'Brien | `["subcontractor"]` | General Builder | 0412 000 003 |

### 3.2 Property Record (`properties` table)

| Field | Value |
|---|---|
| `id` | `demo_property_1` |
| `street` | `42 Greenwood Drive` |
| `city` | `Kellyville` |
| `state` | `NSW` |
| `postalCode` | `2155` |
| `country` | `Australia` |
| `address` | `42 Greenwood Drive, Kellyville NSW 2155` |
| `propertyType` | `residential` |
| `ownerId` | `demo_contact_owner` |
| `latitude` | `-33.7213` |
| `longitude` | `150.9726` |

### 3.3 Project Record (`projects` table)

| Field | Value |
|---|---|
| `id` | `demo_project_1` |
| `name` | `Greenwood Residential Extension` |
| `propertyId` | `demo_property_1` |
| `ownerId` | `demo_contact_owner` |
| `status` | `in_progress` |
| `startDate` | `now − 60 days` |
| `expectedEndDate` | `now + 90 days` |
| `budget` | `180000` |
| `currency` | `AUD` |
| `description` | `Single-storey rear extension including new bedroom, bathroom, and alfresco area.` |

---

### 3.4 Task Records (`tasks` table)

20 tasks covering all five issue scenarios. Dates expressed as offsets from now.

#### Legend for status icons used in UI validation
- ✅ `completed`
- 🔄 `in_progress`
- ⏳ `pending`
- 🔴 `blocked`
- ❌ `cancelled`

---

#### Scenario 1 — Completed Foundation Chain (background context)

These supply the completed prerequisites that the blocker chain depends on.

| ID | Title | Status | Priority | `dueDate` | `isCriticalPath` | Notes |
|---|---|---|---|---|---|---|
| `demo_task_t01` | Site Survey & Soil Report | ✅ completed | low | `now − 55d` | false | Completed on time |
| `demo_task_t02` | Council DA Approval | ✅ completed | high | `now − 40d` | true | Completed on time |
| `demo_task_t03` | Concrete Slab Pour | ✅ completed | high | `now − 20d` | true | Completed on time |

> **completedDate** for each: same value as their dueDate (no delay).  
> **Dependencies**: T02 → T01, T03 → T02 (T02 depends on T01, T03 depends on T02).

---

#### Scenario 1 — Blocker Chain (High Priority)

| ID | Title | Status | Priority | `dueDate` | `isCriticalPath` | `subcontractorId` | Notes |
|---|---|---|---|---|---|---|---|
| `demo_task_t04` | External Cladding | 🔴 blocked | urgent | `now − 3d` | true | `demo_contact_jake` | **Root blocker**. Overdue by 3 days. Delay reason seeded (material delivery). |
| `demo_task_t05` | Scaffold Assembly | 🔴 blocked | high | `now − 1d` | true | `demo_contact_jake` | **Mid-chain**. Auto-blocked because T04 is blocked. Due yesterday. |
| `demo_task_t06` | Interior Fitout Prep | ⏳ pending | medium | `now + 7d` | false | — | **End of chain**. Waiting on T05. Shows multi-hop blocking. |

> **Dependencies**: T04 → T03, T05 → T04, T06 → T05.  
> **BlockerBar display**: T04 (🔴 BLOCKED) and T05 (🔴 BLOCKED/auto) visible in `BlockerCarousel`.  
> T04 severity = `red` (overdue >2 days). T05 severity = `yellow` (overdue 0–2 days).

---

#### Scenario 2 — Focus-3 Critical-Path Tasks

| ID | Title | Status | Priority | `dueDate` | `isCriticalPath` | Notes |
|---|---|---|---|---|---|---|
| `demo_task_t07` | Frame Roof Plates | 🔄 in_progress | urgent | `now − 3d` | true | 🔴 3d overdue. Highest score. |
| `demo_task_t08` | Window & Door Rough-In | ⏳ pending | high | `now + 0d` (today) | true | 🟡 Due today. Second score. |
| `demo_task_t09` | Roof Batten Install | ⏳ pending | high | `now + 5d` | true | 🟢 5d left. Third score. Waits on T07. |

> **Dependencies**: T09 → T07 (Roof Batten waits on Frame Roof Plates).  
> T04 + T05 rank above these in raw score (urgent + overdue + blocked dependents) but they
> are already shown in the BlockerBar, so the cockpit scorer's `focusExcludeBlockers`
> option drops them from Focus-3, surfacing T07/T08/T09 as the next tier.  
> (If the scorer does not exclude blockers, T04/T05 appear in Focus-3 instead — both
> are valid presentations; testers should validate whichever the implementation chooses.)

---

#### Scenario 3 — Bottom Sheet: Prerequisites + Next-In-Line + Contact

| ID | Title | Status | Priority | `dueDate` | `subcontractorId` | Notes |
|---|---|---|---|---|---|---|
| `demo_task_t10` | Tile Laying — Main Bathroom | ⏳ pending | high | `now + 10d` | `demo_contact_maria` | Depends on T04. Surfaces as **Next-In-Line** when user taps T04 on BlockerBar. |
| `demo_task_t18` | Paint Works — Exterior | ⏳ pending | medium | `now + 30d` | `demo_contact_maria` | Also depends on T04. Second Next-In-Line for T04. |

> **Dependencies**: T10 → T04, T18 → T04.  
> **Bottom Sheet for T04**: prereqs shown = T03 (✅ completed); next-in-line = T10, T18.  
> **Call Subcontractor** quick action uses `demo_contact_jake` (Jake Conlon, 0412 000 001).

---

#### Scenario 4 — Quick Actions (Photo + Call)

| ID | Title | Status | Priority | `dueDate` | `subcontractorId` | Notes |
|---|---|---|---|---|---|---|
| `demo_task_t11` | Site Safety Inspection | 🔄 in_progress | urgent | `now + 2d` | `demo_contact_tom` | **Call Subcontractor** uses Tom O'Brien, 0412 000 003. Two sample photos linked. |

> Two `documents` rows linked to `demo_task_t11` (see §3.6).  
> **Quick Actions** available in Bottom Sheet: Mark as Blocked, Upload Photo (opens camera), Call Subcontractor (opens dialler with 0412 000 003).

---

#### Scenario 5 — Mixed Portfolio (Edge Cases & UI Filtering)

| ID | Title | Status | Priority | `dueDate` | Notes |
|---|---|---|---|---|---|
| `demo_task_t12` | Materials Order — Timber | ✅ completed | low | `now − 10d` | No deps |
| `demo_task_t13` | Materials Order — Roofing | ✅ completed | low | `now − 7d` | No deps |
| `demo_task_t14` | Skip Bin Hire | ✅ completed | low | `now − 5d` | No deps |
| `demo_task_t15` | Electrical Rough-In | ❌ cancelled | medium | `now + 14d` | Replaced by variation. No deps. |
| `demo_task_t16` | Plumbing Rough-In | ⏳ pending | medium | `now + 14d` | No deps. Tests UI with no blocking context. |
| `demo_task_t17` | Insulation Install | ⏳ pending | low | `now + 21d` | No deps |
| `demo_task_t19` | Final Council Inspection | ⏳ pending | high | `now + 85d` | `isCriticalPath: true`. No deps — end milestone. |
| `demo_task_t20` | Site Cleanup & Handover | ⏳ pending | low | `now + 80d` | No deps |

---

### 3.5 Task Dependency Edges (`task_dependencies` table)

| `taskId` (depends on…) | `dependsOnTaskId` | Scenario |
|---|---|---|
| `demo_task_t02` | `demo_task_t01` | Foundation chain |
| `demo_task_t03` | `demo_task_t02` | Foundation chain |
| `demo_task_t04` | `demo_task_t03` | Blocker chain root |
| `demo_task_t05` | `demo_task_t04` | Blocker chain mid |
| `demo_task_t06` | `demo_task_t05` | Blocker chain end (multi-hop) |
| `demo_task_t09` | `demo_task_t07` | Focus-3 chaining |
| `demo_task_t10` | `demo_task_t04` | Bottom Sheet next-in-line |
| `demo_task_t18` | `demo_task_t04` | Bottom Sheet next-in-line (2nd) |

---

### 3.6 Delay Reason (`task_delay_reasons` table)

One delay reason on `demo_task_t04` (External Cladding — the root blocker):

| Field | Value |
|---|---|
| `id` | `demo_delay_t04_1` |
| `taskId` | `demo_task_t04` |
| `reasonTypeId` | `material_delivery` *(seeded by migration 0012)* |
| `notes` | `Cladding panels back-ordered from supplier — no confirmed ETA. Contractor notified 2026-03-03.` |
| `delayDurationDays` | `5` |
| `delayDate` | `now − 3d` (same as task dueDate) |
| `actor` | `Jake Conlon` |

> The `delay_reason_types` seed IDs from migration 0012 should be confirmed.
> If the ID `material_delivery` differs, update to match. The label used in the
> migration is "Material delivery" — use `findAll()` at seed time and match by
> label as a fallback.

---

### 3.7 Document Records (`documents` table)

Two photo documents linked to `demo_task_t11` (Site Safety Inspection):

| Field | Doc 1 | Doc 2 |
|---|---|---|
| `id` | `demo_doc_photo_1` | `demo_doc_photo_2` |
| `taskId` | `demo_task_t11` | `demo_task_t11` |
| `projectId` | `demo_project_1` | `demo_project_1` |
| `type` | `photo` | `photo` |
| `title` | `Scaffold base anchor check` | `Safety net inspection front` |
| `filename` | `photo_scaffold.jpg` | `photo_safety_net.jpg` |
| `mimeType` | `image/jpeg` | `image/jpeg` |
| `localPath` | `assets/demo/photo_scaffold.jpg` | `assets/demo/photo_safety_net.jpg` |
| `status` | `local-only` | `local-only` |
| `size` | `~12000` (12 KB) | `~12000` (12 KB) |

> **Fixture images**: two small JPEG files (12 KB each, solid-colour placeholder
> or a freely licensed construction photo) committed to `assets/demo/`.  
> Using `assets/demo/` (not `__tests__/fixtures/`) keeps them accessible at
> runtime as static bundled assets.

---

## 4. Data Summary Statistics

| Table | Rows seeded |
|---|---|
| `contacts` | 4 |
| `properties` | 1 |
| `projects` | 1 |
| `tasks` | 20 |
| `task_dependencies` | 8 |
| `task_delay_reasons` | 1 |
| `documents` | 2 |
| **Total** | **37 rows** |

---

## 5. Seed Script Design (`seedDemoData.ts`)

```ts
// src/infrastructure/demo/seedDemoData.ts

import { DrizzleDB } from '../database/connection';
import { projects, properties, contacts, tasks,
         taskDependencies, taskDelayReasons, documents } from '../database/schema';
import { eq } from 'drizzle-orm';
import { DEMO_FIXTURES } from './demoFixtures';

export const DEMO_PROJECT_ID = 'demo_project_1';

export async function seedDemoData(db: DrizzleDB): Promise<void> {
  // Idempotency guard
  const existing = await db.select().from(projects)
    .where(eq(projects.id, DEMO_PROJECT_ID));
  if (existing.length > 0) {
    console.log('[seed] Demo data already present — skipping.');
    return;
  }

  console.log('[seed] Inserting demo data...');

  // Insert in foreign-key order
  await db.insert(contacts).values(DEMO_FIXTURES.contacts);
  await db.insert(properties).values(DEMO_FIXTURES.property);
  await db.insert(projects).values(DEMO_FIXTURES.project);
  await db.insert(tasks).values(DEMO_FIXTURES.tasks);
  await db.insert(taskDependencies).values(DEMO_FIXTURES.dependencies);
  await db.insert(taskDelayReasons).values(DEMO_FIXTURES.delayReasons);
  await db.insert(documents).values(DEMO_FIXTURES.documents);

  console.log('[seed] Demo data inserted successfully.');
}
```

### `demoFixtures.ts` structure

```ts
// src/infrastructure/demo/demoFixtures.ts

// All date helpers relative to now:
const now = Date.now();
const daysAgo = (n: number) => now - n * 86_400_000;
const daysFrom = (n: number) => now + n * 86_400_000;

export const DEMO_FIXTURES = {
  contacts: [ /* 4 rows as per §3.1 */ ],
  property:   { /* §3.2 */ },
  project:    { /* §3.3 */ },
  tasks:      [ /* 20 rows as per §3.4 */ ],
  dependencies: [ /* 8 rows as per §3.5 */ ],
  delayReasons: [ /* 1 row as per §3.6 */ ],
  documents:  [ /* 2 rows as per §3.7 */ ],
};
```

### `resetDemoData.ts` structure

```ts
// src/infrastructure/demo/resetDemoData.ts

import { DrizzleDB } from '../database/connection';
import { projects, properties, contacts, tasks,
         taskDependencies, taskDelayReasons, documents } from '../database/schema';
import { eq, like } from 'drizzle-orm';

export async function resetDemoData(db: DrizzleDB): Promise<void> {
  console.log('[seed] Resetting demo data...');
  // Delete in reverse foreign-key order
  await db.delete(taskDelayReasons).where(like(taskDelayReasons.id, 'demo_%'));
  await db.delete(taskDependencies).where(like(taskDependencies.taskId, 'demo_%'));
  await db.delete(documents).where(like(documents.id, 'demo_%'));
  await db.delete(tasks).where(like(tasks.id, 'demo_%'));
  await db.delete(projects).where(like(projects.id, 'demo_%'));
  await db.delete(properties).where(like(properties.id, 'demo_%'));
  await db.delete(contacts).where(like(contacts.id, 'demo_%'));
  console.log('[seed] Demo data cleared.');
}
```

> Using `like(col, 'demo_%')` as a safe scope guard — only rows inserted by
> the seeder (all having `demo_` prefix IDs) are ever deleted.

---

## 6. App Entry Point Wiring (`App.tsx`)

```tsx
// App.tsx (inside existing useEffect / initDb callback, __DEV__ guard)

import { seedDemoData } from './src/infrastructure/demo/seedDemoData';
import { resetDemoData } from './src/infrastructure/demo/resetDemoData';
import Config from 'react-native-config';

// Inside initDatabase().then(async (db) => { ... })
if (__DEV__) {
  if (Config.RESET_DEMO_DATA === 'true') {
    await resetDemoData(db);
    await seedDemoData(db);
  } else if (Config.SEED_DEMO_DATA === 'true') {
    await seedDemoData(db);
  }
}
```

---

## 7. Fixture Image Strategy

Two small JPEG images are needed for `demo_task_t11`'s Quick Actions demo.

**Recommended approach**: use freely licensed (CC0) construction site photos
or generate two 200×200 JPEG placeholders via a utility script at design time.
Commit them to `assets/demo/photo_scaffold.jpg` and `assets/demo/photo_safety_net.jpg`.

The `documents` rows reference `localPath: 'assets/demo/photo_scaffold.jpg'`. At
runtime the app's document viewer/quick-action flow will attempt to load from this
path. Since photos in the seeded scenario are for the "Upload Photo" Quick Action
demo (show that the flow opens correctly), static bundled assets are sufficient.

> If the path must be an absolute RNFS path, the seeder can copy the asset to
> `RNFS.DocumentDirectoryPath` on first run and store the resolved path. Document
> this as a follow-up in `docs/DEMO_DATA.md`.

---

## 8. Acceptance Criteria Mapping

| Issue Criterion | Demo Data Coverage | Verification |
|---|---|---|
| Blocker Bar shows T05 (red/yellow badges) when T04 overdue | T04 blocked + overdue, T05 depends on T04 | `BlockerCarousel` shows 2 cards |
| Focus-3 shows 3 critical tasks with urgency labels | T07 (🔴 3d overdue), T08 (🟡 Due today), T09 (🟢 5d left) | `FocusList` shows 3 ranked rows |
| Tapping a task opens Bottom Sheet with prereqs + next-in-line | T04: prereq = T03 (✅), next-in-line = T10, T18 | Sheet renders both sections |
| Quick Actions: Call Subcontractor + Upload Photo | T04 → Jake (0412 000 001); T11 → Tom (0412 000 003) + 2 docs | Dialler opens; camera modal opens |
| Mixed state tasks visible | Scenario 5: 4 completed, 1 cancelled, 4 pending with no deps | Filter pills show all states |

---

## 9. Open Questions

| # | Question | Proposed Default |
|---|---|---|
| OQ-1 | Should the seed also create project phases? | **No** — not needed for cockpit/bottom-sheet demo. Add if a phase-based view is implemented later. |
| OQ-2 | Should `delay_reason_types` seed IDs from migration 0012 be matched by ID or by label? | Match by label at seed time as a fallback (`findAll()` + `find(rt => rt.label === 'Material delivery')`) to avoid hard-coding an ID that may differ across environments. |
| OQ-3 | Should `npm run seed:demo` target iOS only, or both? | Separate `seed:demo` (iOS) and `seed:demo:android` commands to avoid platform ambiguity. |
| OQ-4 | Does `react-native-config` need a `.env.demo` file? | Yes — create `.env.demo` with `SEED_DEMO_DATA=true` and document this in `docs/DEMO_DATA.md`. Add `.env.demo` to `.gitignore` (or commit without secrets). |
| OQ-5 | Should the seeder also insert a milestone record? | Optional. One milestone `"Structural Frame Complete"` (due `now + 14d`) gives testers context but is not required for cockpit/bottom-sheet validation. Defer unless needed. |

---

## 10. Files to Create / Edit

| File | Action | Notes |
|---|---|---|
| `src/infrastructure/demo/seedDemoData.ts` | **Create** | Seeder function |
| `src/infrastructure/demo/resetDemoData.ts` | **Create** | Wiper function |
| `src/infrastructure/demo/demoFixtures.ts` | **Create** | All data constants |
| `assets/demo/photo_scaffold.jpg` | **Create** | Small JPEG fixture ~12 KB |
| `assets/demo/photo_safety_net.jpg` | **Create** | Small JPEG fixture ~12 KB |
| `App.tsx` | **Edit** | Add `__DEV__` seed trigger |
| `package.json` | **Edit** | Add `seed:demo`, `seed:reset`, `seed:demo:android`, `seed:reset:android` scripts |
| `.env.demo` | **Create** | `SEED_DEMO_DATA=true` |
| `docs/DEMO_DATA.md` | **Create** | Run/reset instructions for testers |
