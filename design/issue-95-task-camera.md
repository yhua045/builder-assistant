# Design: Issue #95 - Add "Use Camera" option to TaskScreen

## Goal
Add a "Use Camera" option to the `TaskScreen` to allow users to capture a photo, preview it, and create a task from it. This provides a third data-entry option alongside Voice and Manual entry.

## Architecture & Interfaces

Following the Clean Architecture pattern, we will introduce the following components:

### 1. Domain Layer
- **Document Entity** (reuse, minimal extension): Add `taskId?: string` to the existing `Document` interface to allow a document to be optionally linked to a task. No new entity is needed — `Document` already models local path, MIME type, upload lifecycle (`status`), camera provenance (`source: 'camera'`), and OCR text.
- **DocumentRepository** (extend): Add `findByTaskId(taskId: string): Promise<Document[]>` to the existing `DocumentRepository` interface.
- **Task Entity**: No change required to `Task` itself; attachments are fetched via `DocumentRepository.findByTaskId()`.

### 2. Application Layer
- **ICameraService**:
  ```typescript
  export type CaptureResult = {
    localUri: string;
    width?: number;
    height?: number;
    sizeBytes?: number;
  };

  export interface ICameraService {
    capturePhoto(options?: { quality?: number; maxWidth?: number; maxHeight?: number }): Promise<CaptureResult | null>;
  }
  ```
- **CreateTaskFromPhotoUseCase**:
  Orchestrates the **immediate creation** of a task from a photo. When called:
  1. Generates a default task title (e.g. `"Task – <date>"`).
  2. Sets `dueDate` to **3 days from the current date**.
  3. Copies the temporary photo from cache to `DocumentDirectoryPath/task-attachments/<taskId>/<uuid>.jpg` via `IFileSystemAdapter`.
  4. Creates a `Document` record (`type: 'photo'`, `source: 'camera'`, `status: 'local-only'`, `taskId`) and saves it via `DocumentRepository`.
  5. Returns the created `Task` so the UI can navigate to `TaskForm` for optional editing.
- **UpdateTaskUseCase** (existing or updated): Accepts amended task details (title, notes, etc.) and persists changes. Additional photos are saved as further `Document` records by calling `CreateTaskFromPhotoUseCase` again or a shared helper.

### 3. Infrastructure Layer
- **NativeCameraService**: Implements `ICameraService` using `react-native-image-picker`. It will handle requesting camera permissions and launching the native camera UI.
- **MockCameraService**: Implements `ICameraService` for testing, returning a deterministic `CaptureResult`.
- **Database**:
  - Add `taskId: text('task_id')` column to the existing `documents` Drizzle table in `schema.ts`.
  - Update `DrizzleDocumentRepository` to map the new column and implement `findByTaskId()`.
  - Run `npm run db:generate` then restart to auto-apply the migration.
  - No new table needed; `documents` with a nullable `task_id` foreign key is sufficient.

### 4. UI Layer
- **TaskScreen**:
  - Add a "Use Camera" button alongside "Voice" and "Manual entry".
  - Manage state for the camera flow (`choose` -> `preview` -> `form`).
- **TaskPhotoPreview**:
  - A new component to display the captured image with "Retake" and "Confirm" buttons.
  - "Confirm" triggers **immediate task creation** and navigates to the `form` view.
  - Shows a brief loading indicator while `CreateTaskFromPhotoUseCase` runs.
- **TaskForm**:
  - Update to accept an already-created `Task` (for edit/update mode) in addition to a draft.
  - Display a horizontally scrollable attachment strip showing thumbnails of all `TaskAttachment` items already linked to the task.
  - The "Submit" button calls **UpdateTaskUseCase** to persist any additional detail changes.

## UX Flow
1. User opens `TaskScreen` and taps "Use Camera".
2. `NativeCameraService.capturePhoto()` is called. If camera permission is not granted, the runtime permission dialog is shown first.
3. The native camera UI opens. The user takes a photo.
4. If the user cancels the native camera, they return to the `choose` view with no side-effects.
5. If a photo is captured, `TaskScreen` transitions to the `preview` view, rendering `TaskPhotoPreview`.
6. In `TaskPhotoPreview`:
   - **Retake**: Calls `capturePhoto()` again. The old temporary cached file is deleted before launching the camera again.
   - **Confirm**: 
     1. Shows a loading indicator.
     2. Calls `CreateTaskFromPhotoUseCase` which:
        - Creates a task with a default title (e.g., `"Task – 20 Feb 2026"`) and `dueDate` set to **3 days from the current date**.
        - Copies the image from cache to `DocumentDirectoryPath` and saves a `TaskAttachment` record linked to the task.
     3. On success, transitions to the `form` view in **edit mode**, showing the newly created task pre-loaded with the attached image thumbnail.
7. In `TaskForm` (edit mode):
   - The user sees the task that was just created, including the photo thumbnail in an attachment strip.
   - The user can update the title, notes, due date, priority, etc.
   - The user can optionally capture **additional photos or documents** to append more attachments to the same task.
   - Tapping **Submit** calls `UpdateTaskUseCase` to save the updated task details.
8. On success, the modal closes and a success toast is shown. Any remaining temporary cached files are deleted.
9. On cancel (from `TaskForm` edit mode), the already-created task remains saved (with its default title and attachment). The user can edit it later from the task list.

## Storage & File Handling
- `react-native-image-picker` saves captured photos to the app's temporary cache directory.
- On **Confirm**, `CreateTaskFromPhotoUseCase` copies the file from cache to `DocumentDirectoryPath/task-attachments/<taskId>/<uuid>.jpg` via `IFileSystemAdapter`, ensuring the OS does not evict it.
- If the user **retakes** the photo or **cancels** before confirming, the temporary cached file is deleted immediately.
- A single task can have **multiple attachments** (images or documents). Each is stored as a separate `Document` record (`taskId` set, `type: 'photo'`) and a corresponding file in `DocumentDirectoryPath`.
- JPEG compression quality defaults to **80%** and max resolution is capped at **2048px** on the longest edge to keep file sizes manageable.
- If a task is deleted, its `Document` records should be cleaned up by a `DeleteTaskDocumentsUseCase` helper (physical files removed, then DB records deleted via `DocumentRepository.delete()`).

## Testing Strategy
- **Unit Tests**:
  - `CreateTaskFromPhotoUseCase`: mock `ITaskRepository`, `DocumentRepository`, and `IFileSystemAdapter` to assert the task is created with the correct default title/due date, the file is copied, and a `Document` record is saved with `taskId`, `type: 'photo'`, `source: 'camera'`.
  - `UpdateTaskUseCase`: assert that updated fields are persisted and linked `Document` records are unaffected.
- **Integration Tests**:
  - `TaskScreen` UI: mock `ICameraService` to return a deterministic `CaptureResult`. Simulate tapping "Use Camera" → "Confirm" → assert the task is created, the form shows the attachment thumbnail, and tapping "Submit" calls the update use case.
  - Verify that tapping "Retake" deletes the old temp file before opening the camera again.
  - Verify that cancelling from `TaskPhotoPreview` deletes the temp file and returns to the `choose` view.

## Acceptance Criteria
- [ ] "Use Camera" button visible on `TaskScreen`.
- [ ] Camera permission flow is handled; camera opens when allowed.
- [ ] After capture, preview is shown with "Retake" and "Confirm" buttons.
- [ ] Tapping "Retake" deletes the old temp file and reopens the camera.
- [ ] Tapping "Confirm" immediately creates a task with a default title and `dueDate` set to 3 days from today.
- [ ] The created task has the captured photo persisted as a `TaskAttachment` record and file in `DocumentDirectoryPath`.
- [ ] The user is redirected to `TaskForm` in edit mode, showing the attachment thumbnail.
- [ ] The user can optionally add further details and more attachments; tapping "Submit" updates the task.
- [ ] Multiple attachments can be added to a single task.
- [ ] Temporary cached images are removed on retake or cancel.
- [ ] `ICameraService` mock exists and is used in tests.
- [ ] `Document.taskId` field added; Drizzle migration generated and applied.
- [ ] `DocumentRepository.findByTaskId()` implemented and tested.
- [ ] Task deletion triggers cleanup of linked `Document` records and physical files.
