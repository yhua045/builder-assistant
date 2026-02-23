# Design — Issue #97: LocationService — Find Nearby Projects & Rank Matches

**Date:** 2026-02-23  
**Branch:** `issue-97-location-service`  
**Status:** Approved — implementation complete ✓

---

## 1. User Story

> As a builder onsite, I want the app to suggest the nearest project automatically when I create a new task, so that I spend less time typing and selecting the right job.

The service receives the user's GPS coordinates and returns a ranked list of project properties within a configurable radius, enabling pre-selection of the default project during task entry.

---

## 2. Scope

### Included
- `ILocationService` port in `src/application/services/` (types + interface)
- `GetNearbyProjectsUseCase` in `src/application/usecases/location/`
- `LocalLocationAdapter` in `src/infrastructure/location/` — offline-first, Haversine-based
- `RemoteLocationAdapter` in `src/infrastructure/location/` — skeleton for future server-side spatial query
- Schema migration: add `latitude` / `longitude` (nullable reals) to `properties` table
- Domain entity update: add optional `latitude` / `longitude` to `Property`
- Unit tests for `GetNearbyProjectsUseCase` (seeded local data, mocked adapters)
- Integration test for `LocalLocationAdapter` (Drizzle in-memory SQLite)
- DI registration update in `src/infrastructure/di/registerServices.ts`

### Not Included
- Server-side spatial API endpoint (PostGIS / backend — separate backend ticket)
- UI wiring in TaskScreen (follow-on issue)
- Continuous background scanning for nearest project
- Geocoding (address → coordinates) — separate issue

---

## 3. Architecture & File Layout

```
src/
  domain/
    entities/
      Property.ts                              ← add latitude?, longitude? fields
  application/
    services/
      ILocationService.ts                      ← NEW port (types + interface)
    usecases/
      location/
        GetBestLocationUseCase.ts              ← existing (unchanged)
        GetNearbyProjectsUseCase.ts            ← NEW use case
  infrastructure/
    location/
      DeviceGpsService.ts                      ← existing (unchanged)
      MockGpsService.ts                        ← existing (unchanged)
      DrizzleStoredLocationRepository.ts       ← existing (unchanged)
      LocalLocationAdapter.ts                  ← NEW offline adapter
      RemoteLocationAdapter.ts                 ← NEW remote adapter skeleton

src/infrastructure/database/
  schema.ts                                    ← add lat/lon to properties table

drizzle/migrations/
  <timestamp>_add_property_coords.sql          ← NEW migration

__tests__/
  unit/
    GetNearbyProjectsUseCase.test.ts           ← NEW
  integration/
    LocalLocationAdapter.integration.test.ts   ← NEW
```

---

## 4. Domain Model Changes

### `Property` entity (`src/domain/entities/Property.ts`)

Add two optional co-ordinate fields:

```ts
export interface Property {
  // ... existing fields ...
  latitude?: number | null;
  longitude?: number | null;
}
```

**Rationale:** Keeping coordinates on `Property` (not `Project`) is correct because a property is a physical location. Multiple projects may share one property.

### Database Schema (`src/infrastructure/database/schema.ts`)

```ts
export const properties = sqliteTable('properties', {
  // ... existing columns ...
  latitude:  real('latitude'),   // nullable — populated after geocoding or manual entry
  longitude: real('longitude'),  // nullable
});
```

A Drizzle migration will be generated with `npm run db:generate` and applied on next app start.

---

## 5. New Types & Interface

### `src/application/services/ILocationService.ts`

```ts
export type NearbySearchOptions = {
  radiusKm?: number;       // default 5
  maxResults?: number;     // default 10
  minConfidence?: number;  // 0..1 — filter out results below this score
  sortBy?: 'distance' | 'relevance' | 'recentActivity';
};

export type PropertyMatch = {
  projectId: string;
  propertyId?: string | null;
  address: string;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  rankingScore: number;    // 0..1 normalised composite score
  reason?: string;         // human-readable hint, e.g. "very close", "recent activity"
};

export interface ILocationService {
  /**
   * Returns a ranked list of projects whose associated property lies within
   * `opts.radiusKm` of the given coordinates.
   */
  findNearbyProjects(
    latitude: number,
    longitude: number,
    opts?: NearbySearchOptions,
  ): Promise<PropertyMatch[]>;

  /** Optional pure helper — Haversine great-circle distance in metres. */
  computeDistanceMeters?(
    latA: number, lonA: number,
    latB: number, lonB: number,
  ): number;
}

export default ILocationService;
```

---

## 6. Use Case

### `src/application/usecases/location/GetNearbyProjectsUseCase.ts`

**Responsibilities:**
1. Accept user coordinates + options.
2. Check network availability (injected `NetworkStatusProvider`).
3. If online → delegate to `RemoteLocationAdapter`; on failure fall back to `LocalLocationAdapter`.
4. If offline → use `LocalLocationAdapter` directly.
5. Apply `minConfidence` and `maxResults` filtering / slicing on the merged result.
6. Return sorted `PropertyMatch[]`.

**Constructor injection:**
```ts
constructor(
  private readonly local: ILocationService,
  private readonly remote: ILocationService,
  private readonly network: NetworkStatusProvider,
) {}
```

**`NetworkStatusProvider` port (inline in use-case file for now):**
```ts
export interface NetworkStatusProvider {
  isOnline(): boolean;
}
```

---

## 7. Infrastructure Adapters

### `LocalLocationAdapter`

- Queries the `properties` table via Drizzle, filtering only rows where `latitude IS NOT NULL AND longitude IS NOT NULL`.
- **Bounding-box pre-filter** (fast): compute `Δlat` and `Δlon` for `radiusKm` and discard rows outside the envelope before Haversine.
- **Haversine computation** (precise): for remaining candidates computes exact distance.
- **Ranking:** composite score weighted as:
  - Proximity weight 0.7: `1 − (distanceMeters / (radiusKm * 1000))`
  - Recency weight 0.3: normalised `updatedAt` of the project within the result set (most recently updated = 1.0)
- Returns sorted descending by `rankingScore`.

```ts
export class LocalLocationAdapter implements ILocationService {
  constructor(private readonly db: DrizzleDb) {}

  async findNearbyProjects(lat, lon, opts = {}): Promise<PropertyMatch[]> { ... }

  computeDistanceMeters(latA, lonA, latB, lonB): number {
    // Haversine formula — pure, no IO
  }
}
```

### `RemoteLocationAdapter` (skeleton only in this issue)

- Calls `GET /api/projects/nearby?lat=&lon=&radiusKm=&maxResults=`
- Returns `PropertyMatch[]` deserialized from JSON.
- On HTTP error or network timeout, throws so `GetNearbyProjectsUseCase` can fall back to local.
- **No server endpoint exists yet** — the class will throw `not_implemented` until the backend work is done.

---

## 8. Haversine Formula (Reference)

$$
a = \sin^2\!\!\left(\frac{\Delta\phi}{2}\right) + \cos\phi_1 \cos\phi_2 \sin^2\!\!\left(\frac{\Delta\lambda}{2}\right)
$$
$$
d = 2R \arctan2\!\left(\sqrt{a},\,\sqrt{1-a}\right), \quad R = 6{,}371{,}000\ \text{m}
$$

This is a pure arithmetic function; no dependencies, easy to unit-test.

---

## 9. Migration Plan

1. Edit `src/infrastructure/database/schema.ts` — add `latitude` / `longitude` nullable real columns to `properties`.
2. Run `npm run db:generate` → generates `drizzle/migrations/<ts>_add_property_coords.sql`.
3. Verify the SQL contains `ALTER TABLE properties ADD COLUMN latitude REAL;` and equivalent for longitude.
4. Restart app — migration applied automatically via `initDatabase()`.
5. No data backfill required at this stage; coordinates will be `NULL` until populated by geocoding or manual override.

---

## 10. DI Registration

In `src/infrastructure/di/registerServices.ts`:

```ts
// Location (nearby projects)
const localAdapter   = new LocalLocationAdapter(db);
const remoteAdapter  = new RemoteLocationAdapter(httpClient);
const networkStatus  = new NetworkStatusAdapter();

container.register('GetNearbyProjectsUseCase', () =>
  new GetNearbyProjectsUseCase(localAdapter, remoteAdapter, networkStatus)
);
```

---

## 11. Test Plan

### Unit tests — `__tests__/unit/GetNearbyProjectsUseCase.test.ts`

| Test | Description |
|------|-------------|
| `returns local results when offline` | Mock network → offline; mock local returns 3 matches; assert use case returns them. |
| `delegates to remote when online` | Mock network → online; mock remote returns 2 matches; assert returned. |
| `falls back to local on remote failure` | Mock network → online; mock remote throws; mock local returns 1; assert fallback used. |
| `applies maxResults cap` | Local returns 15 matches; `maxResults: 5`; assert 5 returned. |
| `applies minConfidence filter` | Local returns mix of scores; assert results < threshold excluded. |
| `returns empty array when no properties` | Seeded empty list → `[]` returned. |

### Unit tests — Haversine utility

| Test | Description |
|------|-------------|
| `same point = 0 metres` | (lat, lon) same for A and B. |
| `Sydney CBD to ~1 km north` | Expected ≈ 1000 m ± 5 m. |
| `antipodal points ≈ 20,015 km` | Upper-bound sanity check. |

### Integration tests — `__tests__/integration/LocalLocationAdapter.integration.test.ts`

| Test | Description |
|------|-------------|
| `finds property within radius` | Seed 2 properties: one inside, one outside 5 km; assert only inside returned. |
| `respects radiusKm option` | Same seed; change radius to 2 km; assert count changes. |
| `ranks closer property higher` | Two properties inside radius; assert nearer one has higher `rankingScore`. |
| `skips properties without coordinates` | Seed one with `latitude = null`; assert excluded from results. |
| `respects maxResults` | Seed 5 in-radius properties; `maxResults: 3`; assert 3 returned. |

---

## 12. Acceptance Criteria (from issue)

- [ ] `ILocationService` port exists with `findNearbyProjects` and `PropertyMatch` return type.
- [ ] `RemoteLocationAdapter` skeleton exists (connects to server API; throws `not_implemented` for now).
- [ ] `LocalLocationAdapter` computes distances correctly (Haversine) and returns ranked results.
- [ ] `GetNearbyProjectsUseCase` chooses remote adapter when online, falls back to local when offline or on remote failure.
- [ ] Results include `rankingScore` and `distanceMeters`.
- [ ] Configurable `radiusKm` and `maxResults` are both honoured.
- [ ] Unit and integration tests pass for all core behaviours listed above.
- [ ] TypeScript strict-mode — `npx tsc --noEmit` passes with no errors.
- [ ] `Property` entity and `properties` schema table include optional `latitude` / `longitude` fields.

---

## 13. Open Questions

1. **Property coordinates population** — How will `latitude`/`longitude` be populated on existing `Property` records? Options: (a) manual entry in the property form, (b) geocoding from address on save, (c) GPS capture when creating a project onsite. Geocoding is out of scope here but the schema change must not block it.
2. **`NetworkStatusProvider`** — Is there an existing network-status abstraction in the repo, or should we introduce a minimal one? Prefer reuse.
3. **Recency signal** — `updatedAt` on project is a proxy for "recent activity". Should we use task `createdAt` (last task on project) as a richer recency signal?
4. **Bounding box performance** — ~~Consider SQLite R-Tree module.~~ **Decision: not needed.** A medium-to-small builder carries 10–20 active projects (and at most a few hundred archived ones with coordinates). A full `properties` table scan filtered by a `WHERE latitude BETWEEN … AND longitude BETWEEN …` bounding box, followed by Haversine in JS, runs in well under 1 ms at that scale. R-Tree only pays off at thousands of spatial records; the overhead of a separate virtual table, manual sync triggers, and loss of Drizzle type-safety is unjustified here. If the data-set ever grows significantly, storing a geohash prefix (4-char ≈ 40 km cell) as an indexed column would be the minimal-complexity upgrade path — no R-Tree required. **Resolved: use bounding-box + Haversine only.**

---

## 14. Out-of-Scope / Future Work

- Server-side `/api/projects/nearby` endpoint (PostGIS)
- Geocoding service (address → lat/lon)
- TaskScreen UI to consume `GetNearbyProjectsUseCase`
- Background polling / nearest-project badge on dashboard
- Geofence enter/exit triggers
