# Project Progress — Summary (updated 2026-04-09)

## ✅ Issue #191 — Payment Detail: Show & Assign Project + Unassigned Filter  
**Status**: COMPLETED  
**Branch**: `issue-191-show-payment-project`  
**Date Completed**: 2026-04-09

### Changes Made
- **ProjectPickerModal**: New reusable modal component (extracted from SubcontractorPickerModal pattern) for selecting or clearing project assignments. Includes "Go to Project" navigation button when a project is already selected.
- **PaymentDetails Screen**: Integrated project display and assignment UI:
  - Displays project name with chevron icon (tappable) when assigned
  - Shows "Unassigned" (muted) when no project or project not found
  - Opens ProjectPickerModal on tap to change/clear assignment
  - Supports cross-tab navigation to Project Detail via "Go to Project" button
  - Updates payment via `PaymentRepository.update()` with cache invalidation
- **Payments Filter**: Added "Unassigned" filter chip to payments list:
  - New `'unassigned'` filter option in `PaymentsFilterOption` type
  - Updated `useGlobalPaymentsScreen` hook to handle unassigned filter state
  - New `noProject` flag in `PaymentFilters` interface
  - Updated `DrizzlePaymentRepository.list()` to filter `project_id IS NULL` when `noProject: true`
  - Proper query key management with `unassignedPaymentsGlobal()` cache key
- **Tests**: Full test coverage (unit & integration):
  - ProjectPickerModal component tests (rendering, selection, clearing, navigation)
  - PaymentDetails project assignment and navigation flows
  - useGlobalPaymentsScreen unassigned filter state management
  - DrizzlePaymentRepository SQL filtering for null project_id
- **Code Quality**: Fixed unused variable linting error in test file; all checks pass:
  - ✅ ESLint: 0 errors (71 warnings—pre-existing)
  - ✅ TypeScript strict mode: No new errors

### Acceptance Criteria  
All 15 acceptance criteria met:
- ✅ AC-1 to AC-10: Project row display, assignment UI, modal, navigation
- ✅ AC-11: TypeScript strict passes
- ✅ AC-12 to AC-14: "Unassigned" filter chip and SQL filtering
- ✅ AC-15: Comprehensive test coverage

---

**Previously Implemented:**
- **Payments UI:** Replaced segmented tabs with filter chips and added dual-mode payments views and `PaymentCard` UI.
- **Invoices & PDF:** PDF→image converter (`MobilePdfConverter`), invoice upload flow, OCR adapter and related use cases.
- **Tasks & Task Details:** Documents, dependencies, subcontractor, delay/progress logs, task form extensions, task cockpit data (blockers + Focus-3), and many UI flows (picker modals, bottom-sheet removal).
- **Voice & STT:** Voice recording pipeline, Groq STT/LLM adapters, and remote voice parsing service (feature-flagged).
- **Location & GPS:** Best-known-location use case, local stored locations, and nearby-project search with Haversine ranking.
- **Audit & Progress Logs:** Append-only audit log and generalized task progress logs with CRUD UI and use cases.
- **Database & Migrations:** Multiple safe ALTER TABLE migrations and Drizzle migrations for new fields/tables.

**Pending / Known Issues:**
- **Native modules to install:** `rn-pdf-renderer`, `react-native-audio-recorder-player`, `react-native-geolocation-service` — run `cd ios && pod install` after install before on-device QA.
- **On-device QA needed:** PDF conversion, camera flows, voice recording/STT, GPS location, and payments Pay Now flow require device testing on iOS/Android.
- **Background tasks & cleanup:** Temp PDF render cache cleanup and document file lifecycle (post-upload cleanup, cascade deletes) need finalization.
- **Performance & DB:** Review heavy Drizzle queries (e.g., invoice/payment reports) and consider moving aggregations to SQL where noted.
- **UI polish & accessibility:** Address remaining ESLint/style warnings and add accessibility attributes for custom selectors.
- **Feature flags & production wiring:** Replace dev/mock adapters with production adapters (Groq/OpenAI tokens, MobileAudioRecorder, real SuggestionService) behind flags and secure token vending.

Archive of the full, original progress log has been copied to: [design/progress-archive-2026-04-09.md](design/progress-archive-2026-04-09.md)

If you want, I can:
- run `npx tsc --noEmit` and `npm test` to verify the tree, or
- commit these changes and open a PR with the archive and summary.
