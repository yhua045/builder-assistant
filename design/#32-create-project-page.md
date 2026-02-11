````markdown
# #32 — Create Projects Page (design)

Issue: https://github.com/yhua045/builder-assistant/issues/32

Status: Draft — planning in progress

Summary
- Goal: Add a Projects list / Projects page that shows project cards, quick filters, and primary project actions (archive, unarchive, update status).

User story
- As a user, I want to see all my projects in a single list so I can quickly identify active work, view key stats, and act on projects.

Acceptance criteria
- Projects page exists at the `Projects` tab and is reachable from the app's main navigation.
- Projects are listed in descending last-updated order, grouped by status (active, archived) when toggled.
- Each project card shows: `title`, `client` (if present), `dueDate` (if present), `totalCost`, and status badge.
- Primary actions on each card: open project details, archive/unarchive, toggle favourite, quick status change.
- Page passes unit tests for the UI behaviour and integration tests for repository-backed listing.

Design artifacts
- Layout and visual style: Keep the page layout consistent with other pages in the app (use the same title styles, font families, sizing, spacing, header and list behaviour). Reuse existing typography and spacing tokens from the global styles and NativeWind/Tailwind conventions used elsewhere.
- No mockups: There will be no mockup screens provided for this ticket — implement the UI using existing component patterns and style conventions.
- Component breakdown: `ProjectsPage` (container), `ProjectsList` (list behaviour), `ProjectCard` (card UI), `ProjectsFilters` (search + status toggle), `ProjectsEmptyState`.

API / Contracts
- Use existing `ProjectRepository` interface (`src/domain/repositories/ProjectRepository`) — call `list({ filter, sort, page, pageSize })` and expect `{ items, meta }`.
- Use `useProjects()` hook for pagination and cache where available.

Data / Schema changes
- None expected for initial listing. If additional computed fields are required (e.g., `totalCost`), implement them as derived domain getters on the `Project` entity or in the repository query projection.

Migration notes
- No DB migrations planned for listing-only work. If adding new fields, author a drizzle migration and include a migration test.

Testing plan
- Unit tests
  - `ProjectsPage` renders list when `useProjects` returns items.
  - `ProjectCard` shows metadata and action buttons; action callbacks invoked on press.
- Integration tests
  - Add integration test in `__tests__/integration/` that seeds Drizzle with sample projects and asserts listing and pagination behaviour.
  - Ensure integration tests use test database and are isolated with explicit timeouts.

Implementation tasks (rough)
1. Create `ProjectsPage` container and route it under main tabs.
2. Create `ProjectsList` component and reuse `ProjectCard` styles.
3. Wire `useProjects()` and display pagination/loading/error states.
4. Add unit tests under `__tests__/unit/` and integration under `__tests__/integration/`.
5. Run `npx tsc --noEmit` and `npm test` to validate.

Files to modify/create
- `src/pages/projects/ProjectsPage.tsx`
- `src/components/ProjectCard.tsx` (reuse/refactor existing `ProjectCard.tsx` as needed)
- `src/hooks/useProjects.ts` (ensure list API shape matches)
- `__tests__/unit/ProjectsPage.test.tsx`
- `__tests__/integration/ProjectsList.integration.test.ts`

Open questions / decisions
- Should the page support server-side pagination or infinite scroll? (Recommendation: start with simple paginated list.) => initial implementation, use paginated list with "Load More" button to keep it simple and testable.
- Sorting and grouping UX: provide a toggle to group by `status` or show combined list with visual badges. => by status toggle to group active vs archived projects, with clear section headers.

Estimated effort
- 1.5 — 3 days depending on mock availability and test scaffolding.

Reviewers
- Tag: `@yhua045`, `@maintainers`

````
