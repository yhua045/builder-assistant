# #43 — Finish Manual Project Entry — Navigation, DatePickers, User Dropdowns

## Summary / User Story

As a user, I want to access the Manual Project Entry form from the Projects page and dashboard, and I want improved UX controls (date pickers and user/team selectors) so that I can efficiently create projects with valid, well-structured data.

## Scope

This issue completes the Manual Project Entry implementation started in #39 by:
1. **Navigation wiring**: Make `ManualProjectEntry` accessible from Projects page and dashboard
2. **Date picker UX**: Replace text inputs for dates with native date-picker components
3. **Owner/Team selectors**: Replace free-text inputs with dropdown/autocomplete components

## Context

- Related: issue #39 (base form implementation)
- Current state: `ManualProjectEntryForm` and `ManualProjectEntryButton` exist but are not wired into main navigation
- Progress notes in `progress.md` document current implementation status

## Proposed Changes

### 1. Navigation Integration

#### Projects Page Integration
- The "Manual Project Entry" button on the Projects page should open the `ManualProjectEntryForm` as a modal or screen (per existing navigation patterns).
- Button opens `ManualProjectEntryForm` as modal/screen
- On successful save, refresh projects list and show success feedback
- On cancel, return to projects list without changes

#### Dashboard Integration
- The "Manual Project Entry" button on the dashboard should open the `ManualProjectEntryForm` as a modal or screen (per existing navigation patterns).
- Opens same `ManualProjectEntryForm` flow
- On success, update dashboard metrics/recent projects

**Navigation Pattern**: Use modal presentation on mobile (React Navigation modal) for quick add flow. Consider stack navigation if form becomes multi-step in future.

### 2. Date Picker Components

Replace text inputs for `Start Date` and `End Date` with platform-appropriate date pickers:

**Component**: `DatePickerInput` (new shared component in `src/components/inputs/`)
- Props: `label`, `value: Date | null`, `onChange: (date: Date | null) => void`, `minDate?`, `maxDate?`, `required?`, `error?`
- Platform behavior:
  - iOS: Use `@react-native-community/datetimepicker` with iOS native picker
  - Android: Use `@react-native-community/datetimepicker` with Android native picker
  - Web: Use HTML5 date input or web-compatible picker fallback

**Validation**:
- End Date must not be before Start Date (cross-field validation)
- Show inline error when validation fails
- Clear error on field change

### 3. Owner/Team Selector Components

Replace free-text owner and team inputs with autocomplete/dropdown selectors:

#### Owner Selector
**Component**: `ContactSelector` (new in `src/components/inputs/`)
- Props: `label`, `value: string | null`, `onChange: (contactId: string) => void`, `error?`
- Data source: Query `contacts` repository or use `useContacts` hook
- Behavior:
  - Dropdown/autocomplete with search/filter
  - Display contact name + role/title
  - Allow "free text entry" in the dropdown if contact not found (future: wires to create contact flow)
  - Debounce search queries (300ms) for performance

#### Team Selector
**Component**: `TeamSelector` (new in `src/components/inputs/`)
- Props: `label`, `value: string | null`, `onChange: (teamId: string) => void`, `multiSelect?: boolean`, `error?`
- Data source: Query `teams` repository or use `useTeams` hook
- Behavior:
  - Dropdown with search/filter
  - Display team name + member count
  - Allow "free text entry" in the dropdown if contact not found (future: wires to create contact flow)
  - Debounce search queries for performance

**Repository/Hook Requirements**:
- Ensure `contacts` repository exists with `getAll()` and `search(query)` methods
- Ensure `teams` repository exists with `getAll()` and `search(query)` methods
- If hooks don't exist, create `useContacts` and `useTeams` hooks in `src/hooks/`

### 4. Form Updates

Update `ManualProjectEntryForm`:
- Replace `Start Date` / `End Date` text inputs with `DatePickerInput`
- Replace `Project Owner` text input with `ContactSelector`
- Replace `Team` text input with `TeamSelector`
- Add cross-field validation for date range
- Maintain existing validation rules and save/cancel behavior

## Acceptance Criteria (testable)

### Navigation
- [ ] "Add Project" button exists on Projects page and opens the form
- [ ] "Quick Add Project" option exists on dashboard and opens the form
- [ ] Form opens as modal/screen with proper navigation stack
- [ ] Save closes form and returns to originating screen with success feedback
- [ ] Cancel closes form without saving and returns to originating screen

### Date Pickers
- [ ] Start Date and End Date use native date picker components
- [ ] Date pickers show current value or placeholder appropriately
- [ ] Selecting a date updates the form state
- [ ] End Date before Start Date shows inline validation error
- [ ] Validation error clears when dates are corrected
- [ ] Dates are properly formatted and saved to database

### Owner/Team Selectors
- [ ] Owner field uses `ContactSelector` with searchable dropdown
- [ ] Team field uses `TeamSelector` with searchable dropdown
- [ ] Selectors show existing contacts/teams from database
- [ ] Selecting an option updates form state with correct ID
- [ ] Search/filter functionality works with debouncing
- [ ] "Create New" option is available (future: wires to create flow)
- [ ] Selected values are properly saved to database

### Overall UX
- [ ] All new controls have accessibility labels
- [ ] Required field indicators match existing form patterns
- [ ] Error states are clearly visible and consistent
- [ ] Form maintains existing save/cancel behavior

## Tests (TDD)

### Unit Tests (`__tests__/unit/`)

1. **DatePickerInput.test.tsx** (new)
   - Renders with label and current value
   - Calls onChange when date selected
   - Shows error message when provided
   - Respects minDate/maxDate constraints

2. **ContactSelector.test.tsx** (new)
   - Renders with label and fetches contacts
   - Filters contacts based on search input (debounced)
   - Calls onChange with selected contact ID
   - Shows "Create New" option

3. **TeamSelector.test.tsx** (new)
   - Renders with label and fetches teams
   - Filters teams based on search input (debounced)
   - Calls onChange with selected team ID
   - Shows "Create New" option

4. **ManualProjectEntryForm.test.tsx** (update existing)
   - Date pickers render and update state correctly
   - Contact/Team selectors render and update state correctly
   - Cross-field date validation works (End >= Start)
   - Save calls createProject with properly formatted dates and IDs
   - Cancel closes without saving

5. **ProjectsPage.test.tsx** (update existing)
   - "Add Project" button renders and opens form
   - Form save refreshes projects list
   - Form cancel returns without changes

6. **Dashboard.test.tsx** (new or update existing)
   - "Quick Add Project" option renders and opens form
   - Form interactions work from dashboard context

### Integration Tests (`__tests__/integration/`)

1. **ManualProjectEntry.navigation.test.tsx** (new)
   - Opening form from Projects page shows correct navigation
   - Opening form from Dashboard shows correct navigation
   - Save navigation returns to origin with success message

2. **useContacts.integration.test.tsx** (new if needed)
   - Hook fetches contacts from Drizzle repository
   - Search/filter queries work correctly

3. **useTeams.integration.test.tsx** (new if needed)
   - Hook fetches teams from Drizzle repository
   - Search/filter queries work correctly

## Implementation Plan

### Phase 1: Foundation & Tests
1. **Audit existing code**:
   - Check if `contacts` and `teams` repositories exist
   - Check if navigation structure supports modal/screen patterns
   - Identify reusable form components

2. **Write failing tests**:
   - Create unit tests for new components (DatePickerInput, ContactSelector, TeamSelector)
   - Update existing tests for ManualProjectEntryForm
   - Add navigation integration tests

### Phase 2: Component Implementation
1. **DatePickerInput**:
   - Install `@react-native-community/datetimepicker` (if not present)
   - Create cross-platform DatePickerInput component
   - Handle platform differences (iOS/Android)

2. **ContactSelector & TeamSelector**:
   - Create `contacts` and `teams` repositories if missing
   - Create `useContacts` and `useTeams` hooks if missing
   - Implement autocomplete/dropdown components with debouncing
   - Add "Create New" option (stub for now)

### Phase 3: Form Integration
1. **Update ManualProjectEntryForm**:
   - Replace date text inputs with DatePickerInput
   - Replace owner/team text inputs with selectors
   - Add cross-field date validation
   - Ensure proper data mapping for save

### Phase 4: Navigation Wiring
1. **Projects Page**:
   - Add "Add Project" button to header/FAB
   - Wire button to open ManualProjectEntryForm
   - Handle save/cancel navigation

2. **Dashboard**:
   - Add "Quick Add Project" option
   - Wire to ManualProjectEntryForm
   - Handle save/cancel navigation

### Phase 5: Testing & Refinement
1. Run all tests and ensure they pass
2. Manual testing on iOS/Android simulators
3. Accessibility audit (labels, focus order, screen reader support)
4. Performance check (debouncing, list rendering)

## File Structure

### New Files
```
src/components/inputs/
  DatePickerInput.tsx          # Cross-platform date picker
  ContactSelector.tsx          # Owner/contact autocomplete
  TeamSelector.tsx             # Team autocomplete

src/domain/repositories/
  ContactRepository.ts         # Interface (if missing)
  TeamRepository.ts            # Interface (if missing)

src/infrastructure/repositories/
  DrizzleContactRepository.ts  # Implementation (if missing)
  DrizzleTeamRepository.ts     # Implementation (if missing)

src/hooks/
  useContacts.ts               # Contacts data hook (if missing)
  useTeams.ts                  # Teams data hook (if missing)

__tests__/unit/
  DatePickerInput.test.tsx
  ContactSelector.test.tsx
  TeamSelector.test.tsx
  Dashboard.test.tsx (or update)

__tests__/integration/
  ManualProjectEntry.navigation.test.tsx
  useContacts.integration.test.tsx
  useTeams.integration.test.tsx
```

### Modified Files
```
src/components/ManualProjectEntryForm.tsx
src/pages/ProjectsPage.tsx (or Dashboard.tsx)
__tests__/unit/ManualProjectEntryForm.test.tsx
__tests__/unit/ProjectsPage.test.tsx
```

## Dependencies

### Required Packages
- `@react-native-community/datetimepicker` — native date picker
- Verify React Navigation modal setup exists

### Optional Enhancements
- `react-native-picker-select` or similar for styled dropdowns (if native Select is insufficient)
- Debounce utility from `lodash` or custom implementation

## Validation Rules (Updated)

All existing validation from #39 remains, plus:
- **Date Range**: If both Start Date and End Date are present, End Date >= Start Date
- **Owner ID**: Must be valid UUID/ID from contacts table (or null)
- **Team ID**: Must be valid UUID/ID from teams table (or null)

## Notes / Open Questions

1. **Contacts/Teams Data Model**: 
   - Need to verify current schema for contacts and teams
   - If tables don't exist, may need database migration
   - Decide if we create minimal stub or full implementation

2. **"Create New" Flow**:
   - Current scope: show "Create New" option but don't implement full flow
   - Future work: modal to create contact/team inline

3. **Multi-select for Teams**:
   - Issue description mentions teams but doesn't specify single vs multiple
   - Recommend single team initially, multi-select can be added later

4. **Navigation Pattern**:
   - Confirm modal vs screen preference with user
   - Modal recommended for quick add flow

5. **Date Formatting**:
   - Ensure dates are stored as ISO 8601 strings in SQLite
   - Display format should match user locale preferences

## TDD Workflow Checklist

- [x] Planning session complete (this document)
- [ ] Tests written and failing (red)
- [ ] Minimal implementation to pass tests (green)
- [ ] Refactor for clarity
- [ ] PR created with reference to this design doc
- [ ] PR reviewed and approved
- [ ] Merged and `progress.md` updated

---

Design file created for issue #43. Link this file from PR and `progress.md` when complete.
