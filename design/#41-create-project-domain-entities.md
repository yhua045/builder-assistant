# #41 — Create Domain `Project` and `ProjectDetails`

## Summary

Introduce a domain-centric separation between the write model (`Project`) and
the read model (`ProjectDetails`) so application use-cases and repositories
adhere to Clean Architecture and avoid leaking UI DTOs into the domain.

## Acceptance Criteria

- `src/domain/entities/Project.ts` (write model) exists and contains minimal
  persisted fields and references by ID only.
- `src/domain/entities/ProjectDetails.ts` (read model) exists and extends or
  composes `Project` with hydrated references (`owner: User`, `property: Property`).
- `ProjectRepository` interface updated (backwards-compatible) to expose
  a `findDetailsById(id: string): Promise<ProjectDetails | null>` and
  `listDetails(filters?): Promise<{ items: ProjectDetails[]; meta }>` for
  read-heavy endpoints.
- Unit tests for a new `GetProjectDetailsUseCase` that depend only on the
  `ProjectRepository` abstraction (mocked) — tests should be written first.
- Integration tests for `DrizzleProjectRepository` that verify hydration/join
  behaviour and map to `ProjectDetails`.

## Proposed Domain Types

- `Project` (src/domain/entities/Project.ts)

```ts
export interface Project {
  id: string;
  ownerId: string;
  propertyId?: string;
  name: string;
  status?: string;
  archived?: boolean;
  // minimal fields required for writes
}
```

- `ProjectDetails` (src/domain/entities/ProjectDetails.ts)

```ts
import { Project } from './Project';
import { User } from './User';
import { Property } from './Property';

export interface ProjectDetails extends Project {
  owner: User;
  property?: Property;
  // additional hydrated fields useful for reads
}
```

## Repository Contract Changes

Update `src/domain/repositories/ProjectRepository.ts` to add new read methods
while keeping existing write methods for compatibility:

- `findDetailsById(id: string): Promise<ProjectDetails | null>`
- `listDetails(filters?, options?): Promise<{ items: ProjectDetails[]; meta }>`

Implementation note: adapters that cannot cheaply return hydrated details may
implement the methods by composing existing queries (perform joins) inside the
infrastructure layer (Drizzle). The domain interface must remain simple.

## Use Case

Add `GetProjectDetailsUseCase` in
`src/application/usecases/project/GetProjectDetailsUseCase.ts` with a single
method `execute(id: string)` that returns `ProjectDetails | null` by calling
`projectRepository.findDetailsById(id)`.

Test plan (TDD):

1. Write a unit test for `GetProjectDetailsUseCase` that mocks the
   `ProjectRepository` and expects it to call `findDetailsById` and return the
   hydrated entity. (Red)
2. Implement the use case to call the repository. (Green)
3. Add integration test that uses `DrizzleProjectRepository` and a test DB to
   verify the returned `ProjectDetails` is hydrated. (Green)

## Drizzle / Migration Notes

- No immediate schema changes required for this refactor if the DB already
  stores owner and property relationships; repository implementations will
  perform joins and map rows to `ProjectDetails`.
- If additional fields are required in the DB, follow the migration workflow:
  edit `src/infrastructure/database/schema.ts` → `npm run db:generate` → add
  migration → verify in integration tests.

## Tests to Add

- `__tests__/unit/GetProjectDetailsUseCase.test.ts` — unit test (mock repo)
- `__tests__/integration/DrizzleProjectRepository.details.integration.test.ts` —
  integration test verifying hydration and mapping to `ProjectDetails`.

## Implementation Steps (small commits)

1. Add `src/domain/entities/Project.ts` and `ProjectDetails.ts` (interfaces).
2. Update `src/domain/repositories/ProjectRepository.ts` to add new read methods.
3. Add `GetProjectDetailsUseCase` with unit test (TDD: test first).
4. Implement `DrizzleProjectRepository.findDetailsById` and `listDetails`.
5. Add integration tests for the Drizzle implementation.
6. Refactor mappers and update any UI-to-domain mappings (e.g., `ProjectCardDto`).

## Design Artifacts

- Link design doc to the ticket and record decisions in `progress.md` after
  merge.


---

End of design plan for issue #41.
