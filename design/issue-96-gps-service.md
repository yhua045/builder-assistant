# Design — Issue #96: GPS Service (best-known location, sync/async API)

**Date:** 2026-02-23  
**Branch:** `issue-96-gps-service`  
**Status:** Draft — awaiting agreement before implementation

---

## 1. User Story

> As a builder app user, I want the app to know my location automatically so that location-dependent features (e.g. site photos, reports) can be pre-filled with the correct address.

The service must degrade gracefully: if a fresh GPS fix is unavailable, it returns the most recently stored location.

---

## 2. Scope

### Included
- `IGpsService` port (application layer)
- `IStoredLocationRepository` port (domain layer)
- `GetBestLocationUseCase` (application layer)
- `DeviceGpsService` — real device adapter (infrastructure layer)
- `MockGpsService` — deterministic test stub (infrastructure layer)
- `DrizzleStoredLocationRepository` — Drizzle-backed persistence (infrastructure layer)
- Unit tests: `GetBestLocationUseCase` with mocks
- DI registration in `registerServices.ts`
- New Drizzle schema table `last_known_locations` + migration

### Not Included
- Continuous location streaming / subscription API (deferred)
- Background location tracking
- UI components that consume location

---

## 3. Architecture & File Layout

```
src/
  domain/
    repositories/
      StoredLocationRepository.ts         ← new interface
  application/
    services/
      IGpsService.ts                      ← new port (types + interface)
    usecases/
      location/
        GetBestLocationUseCase.ts         ← new use case
  infrastructure/
    location/
      DeviceGpsService.ts                 ← real device adapter
      MockGpsService.ts                   ← test stub
      DrizzleStoredLocationRepository.ts  ← Drizzle persistence

__tests__/
  unit/
    GetBestLocationUseCase.test.ts        ← new unit tests
```

---

## 4. Types & Interfaces

### `src/application/services/IGpsService.ts`

```ts
export type GeoLocation = {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;   // lower is better; omitted if unknown
  altitude?: number | null;
  timestamp: string;         // ISO 8601
};

export type GetLocationOptions = {
  timeoutMs?: number;                 // default: 10_000
  maxAgeMs?: number;                  // if last-known is fresher, return it immediately
  requiredAccuracyMeters?: number;    // reject current fix if worse than this
};

export interface IGpsService {
  /** Async: best location (current fix, or last-known fallback). May return null. */
  getBestLocation(options?: GetLocationOptions): Promise<GeoLocation | null>;

  /** Sync: cached last-known location, or null. Fast, never throws. */
  getLastKnownLocation(): GeoLocation | null;

  /** Persist a location as the new last-known (called internally by adapters). */
  persistLastKnownLocation(loc: GeoLocation): Promise<void>;
}
```

### `src/domain/repositories/StoredLocationRepository.ts`

```ts
import { GeoLocation } from '../../application/services/IGpsService';

export interface StoredLocationRepository {
  getLastKnown(): Promise<GeoLocation | null>;
  save(loc: GeoLocation): Promise<void>;
}
```

---

## 5. `GetBestLocationUseCase` Behavioural Contract

```
getBestLocation(options):
  1. If options.maxAgeMs set AND cached location exists AND age < maxAgeMs → return cached
  2. Attempt fresh device fix with options.timeoutMs (default 10 s)
     a. If fix acquired AND (requiredAccuracyMeters not set OR accuracy <= threshold):
        - persistLastKnownLocation(fix)
        - update in-memory cache
        - return fix
     b. If fix fails (timeout, permission denied, poor accuracy):
        - return in-memory cache (or load from repo if cache is empty)
  3. If both fail → return null

getLastKnownLocation():
  - return in-memory cached value synchronously (populated on demand from repo)

persistLastKnownLocation(loc):
  - write to StoredLocationRepository
  - update in-memory cache
```

---

## 6. Persistence Strategy

**Decision: Drizzle ORM table** (`last_known_locations`) using an **append-log + prune** pattern, consistent with CLAUDE.md requirement.

> "Drizzle ORM is the canonical and required persistence layer for this project."

New schema entry:

```ts
// schema.ts addition
export const lastKnownLocations = sqliteTable('last_known_locations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  latitude: real('latitude').notNull(),
  longitude: real('longitude').notNull(),
  accuracyMeters: real('accuracy_meters'),
  altitude: real('altitude'),
  timestamp: text('timestamp').notNull(),  // ISO 8601 (device fix time)
  savedAt: integer('saved_at').notNull(),  // Unix ms (wall clock insert time)
});
```

### Write path — append + prune

Each `save()` call **appends** a new row, then **prunes** any rows older than `LOCATION_LOG_RETENTION_MS` (default: 24 hours) in the same operation:

```ts
const LOCATION_LOG_RETENTION_MS = 24 * 60 * 60 * 1000; // 24 h

// save():
await db.insert(lastKnownLocations).values({ ...loc, savedAt: Date.now() });
await db.delete(lastKnownLocations)
  .where(lt(lastKnownLocations.savedAt, Date.now() - LOCATION_LOG_RETENTION_MS));
```

### Read path — most recent row

```ts
// getLastKnown():
const [row] = await db.select()
  .from(lastKnownLocations)
  .orderBy(desc(lastKnownLocations.savedAt))
  .limit(1);
```

### Why append-log + prune over single-row upsert

| Concern | Single-row upsert | Append + prune |
|---|---|---|
| Write atomicity | Needs transaction (delete + insert) | Plain `INSERT` — always atomic |
| Read simplicity | `LIMIT 1` | `ORDER BY savedAt DESC LIMIT 1` |
| Short history for debugging | None | Up to 24 h of fixes |
| Future "best of N" query | Schema change required | Free |
| Table size | Fixed (1 row) | Bounded by prune window |

SQLite serialises all writes so there is no concurrent-writer race, but avoiding the delete-then-insert transaction simplifies the implementation and removes any risk of a brief empty-table window between the two operations.

`LOCATION_LOG_RETENTION_MS` is a named constant in `DrizzleStoredLocationRepository` — easy to adjust without a schema migration.

_Alternative considered: `AsyncStorage` (already installed). Rejected as primary store to keep persistence in a single layer (Drizzle). `AsyncStorage` is acceptable only if a future decision moves light key-value data there._

---

## 7. New Dependency

`react-native-geolocation-service` is **not** currently installed. It must be added:

```bash
npm install react-native-geolocation-service
# iOS: cd ios && pod install
```

Permission manifests must be updated:
- **iOS** `Info.plist`: `NSLocationWhenInUseUsageDescription`
- **Android** `AndroidManifest.xml`: `ACCESS_FINE_LOCATION` + `ACCESS_COARSE_LOCATION`

---

## 8. Mock & Test Implementations

### `MockGpsService` (configurable stub)

```ts
// src/infrastructure/location/MockGpsService.ts
export class MockGpsService implements IGpsService {
  constructor(
    private fixToReturn: GeoLocation | null = null,
    private shouldThrow = false,
  ) {}

  async getBestLocation(): Promise<GeoLocation | null> {
    if (this.shouldThrow) throw new Error('Permission denied');
    return this.fixToReturn;
  }

  getLastKnownLocation(): GeoLocation | null { return this.fixToReturn; }
  async persistLastKnownLocation(loc: GeoLocation): Promise<void> { this.fixToReturn = loc; }
}
```

### `MockStoredLocationRepository`

```ts
export class MockStoredLocationRepository implements StoredLocationRepository {
  private stored: GeoLocation | null = null;
  async getLastKnown() { return this.stored; }
  async save(loc: GeoLocation) { this.stored = loc; }
}
```

---

## 9. DI Registration

```ts
// registerServices.ts additions
import { DeviceGpsService } from '../location/DeviceGpsService';
import { DrizzleStoredLocationRepository } from '../location/DrizzleStoredLocationRepository';

container.registerSingleton('StoredLocationRepository', DrizzleStoredLocationRepository);
container.registerSingleton('GpsService', DeviceGpsService);
```

---

## 10. Test Acceptance Criteria

### Unit Tests — `GetBestLocationUseCase`

| Scenario | Expected |
|---|---|
| `maxAgeMs` set & cached location is fresh | return cached immediately (no device call) |
| Fresh fix acquired within timeout & meets accuracy | return fix, persist it |
| Device fix times out, last-known exists | return last-known |
| Device fix times out, no last-known | return `null` |
| Permission denied, last-known exists | return last-known |
| `requiredAccuracyMeters` set, fix accuracy worse | fall back to last-known |

### Integration Tests

- `DrizzleStoredLocationRepository`: save → getLastKnown roundtrip
- UI smoke test with `MockGpsService` simulating each scenario above

---

## 11. Open Questions (for agreement)

1. **Permission UX**: Should `DeviceGpsService` prompt the user automatically, or should the caller (use case / hook) check permissions before calling? — ***A***: `DeviceGpsService` requests permission internally and surfaces a typed error (`'permission_denied'`) which `GetBestLocationUseCase` catches and handles as fallback.

2. ~~**Single-row vs. timestamped history**~~ **Resolved**: Append-log with 24-hour pruning adopted (see §6). Avoids the delete+insert transaction needed for a single-row upsert, and gives a short debug history for free. Table is bounded by the prune window.

3. **Accuracy requirement**: `requiredAccuracyMeters` defaults to "accept any fix". Should there be an app-level default (e.g. 100 m)? — ***A***: leave undefined (no filter) at use-case level; callers provide their own threshold.

---

## 12. Implementation Order (TDD)

1. Add `StoredLocationRepository` interface (domain)
2. Add `IGpsService` interface (application/services)
3. Add Drizzle schema entry + run `npm run db:generate`
4. **Write failing unit tests** for `GetBestLocationUseCase` using mocks
5. Implement `GetBestLocationUseCase` (make tests pass)
6. Implement `MockGpsService` + `MockStoredLocationRepository`
7. Implement `DrizzleStoredLocationRepository`
8. Implement `DeviceGpsService`
9. Register in DI container
10. Add integration tests for repository roundtrip
11. Update `progress.md`
