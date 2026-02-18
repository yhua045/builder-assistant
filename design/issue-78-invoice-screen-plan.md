# Issue #78: InvoiceScreen Popup - Upload PDF or Manual Entry

**Issue**: [#78](https://github.com/yhua045/builder-assistant/issues/78)  
**Created**: 2026-02-18  
**Status**: Planning  
**Branch**: `issue-78` (worktree: `worktrees/issue-78`)

---

## User Story

**As a** construction project manager  
**I want** a quick way to create invoices by either uploading a PDF or entering details manually  
**So that** I can efficiently track vendor invoices regardless of whether I have a digital document or need to transcribe from paper

---

## Scope

### In Scope
- Create `InvoiceScreen` modal/popup page mirroring `SnapReceiptScreen` layout
- Two primary action flows:
  1. **Upload Invoice PDF** - file picker that accepts PDFs, persists to storage/repository
  2. **Manual Entry** - opens `InvoiceForm` for creating invoices from scratch
- Navigation and styling consistent with existing Receipt and Invoice screens
- Unit and integration tests for rendering and action handlers

### Out of Scope
- PDF parsing/OCR functionality (deferred for future iteration)
- Invoice editing (use existing `InvoiceDetailPage` flow)
- Multi-file upload or batch processing
- PDF preview/viewer within the app

---

## UI Component Sketch

### Layout Structure (based on `SnapReceiptScreen.tsx`)

```
┌─────────────────────────────────────────┐
│  InvoiceScreen (Modal/Overlay)          │
│  ─────────────────────────────────────  │
│                                         │
│  📄 Add Invoice                         │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │  [📎 Upload Invoice PDF]          │ │
│  │                                   │ │
│  │  Select a PDF file to upload     │ │
│  └───────────────────────────────────┘ │
│                                         │
│  ─── Or enter manually ───              │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │  [✏️  Enter Invoice Details]       │ │
│  │                                   │ │
│  │  Manually create an invoice       │ │
│  └───────────────────────────────────┘ │
│                                         │
│  [ Cancel ]                             │
│                                         │
└─────────────────────────────────────────┘
```

### Component Hierarchy

```
<InvoiceScreen>
  └─ <View> (container)
      ├─ <Text> (title: "Add Invoice")
      ├─ <Pressable> (Upload PDF button)
      │   ├─ <Paperclip Icon>
      │   └─ <Text> (label)
      ├─ <Text> (separator: "Or enter manually")
      ├─ <Pressable> (Manual Entry button)
      │   ├─ <Edit Icon>
      │   └─ <Text> (label)
      └─ <Pressable> (Cancel button)
</InvoiceScreen>
```

---

## API / Contracts

### Component Interface

```typescript
// src/pages/invoices/InvoiceScreen.tsx
interface InvoiceScreenProps {
  onClose: () => void;
  onNavigateToForm: (options: { mode: 'create'; pdfFile?: PdfFileMetadata }) => void;
  // Optional: support future PDF parsing
  enablePdfParsing?: boolean;
}

// PDF file metadata cached in memory (not saved to DB until submit)
export interface PdfFileMetadata {
  uri: string;         // File URI in app private storage (after copying from picker)
  originalUri: string; // Original URI from picker (for reference)
  name: string;        // Original filename
  size: number;        // File size in bytes
  mimeType?: string;   // MIME type (application/pdf)
}
```

### File Picker Adapter (Infrastructure Layer)

```typescript
// src/infrastructure/files/IFilePickerAdapter.ts
export interface FilePickerResult {
  cancelled: boolean;
  uri?: string;         // File URI
  name?: string;        // Original filename
  size?: number;        // File size in bytes
  type?: string;        // MIME type
}

export interface IFilePickerAdapter {
  /**
   * Opens a file picker for documents (PDFs)
   * @returns FilePickerResult with file details or cancellation status
   */
  pickDocument(): Promise<FilePickerResult>;
}
```

### File System Utility (Infrastructure Layer)

```typescript
// src/infrastructure/files/IFileSystemAdapter.ts
export interface IFileSystemAdapter {
  /**
   * Copy a file to app's private storage directory
   * @param sourceUri - Original file URI from picker
   * @param destinationFilename - Filename to use in app storage
   * @returns New URI in app private storage
   */
  copyToAppStorage(sourceUri: string, destinationFilename: string): Promise<string>;
  
  /**
   * Get app's private documents directory path
   */
  getDocumentsDirectory(): Promise<string>;
}
```

### Document Entity & Repository (Existing - Domain Layer)

We will **reuse the existing `Document` entity** and `DocumentRepository` interface:

```typescript
// src/domain/entities/Document.ts (EXISTING)
export interface Document {
  id: string;
  localId?: number;
  projectId?: string;
  type?: 'plan' | 'permit' | 'invoice' | 'photo' | string;  // 'invoice' for invoice PDFs
  title?: string;
  mimeType?: string;
  size?: number;
  filename?: string;
  status: DocumentStatus;  // 'local-only' | 'upload-pending' | 'uploaded' | 'failed'
  localPath?: string;
  cloudUrl?: string;
  // ... other fields
}

// src/domain/repositories/DocumentRepository.ts (EXISTING)
export interface DocumentRepository {
  save(document: Document): Promise<void>;
  findById(id: string): Promise<Document | null>;
  findAll(filter?: { projectId?: string; status?: string }): Promise<Document[]>;
  update(document: Document): Promise<void>;
  delete(id: string): Promise<void>;
}
```

**Linking Strategy (Hybrid Approach - Atomic Transaction)**:

To avoid "ghost" Document records when users cancel before submitting, we use a **cache-then-save** pattern:

1. **Upload PDF** → Cache file metadata (`uri`, `name`, `size`) in component state (**NOT saved to DB yet**)
2. **Pass to InvoiceForm** → Navigate with `pdfFile` metadata prop
3. **User submits form** → Create Document + Create Invoice **atomically** in one transaction
4. **User cancels** → File metadata discarded, zero DB writes

**Benefits:**
- ✅ No ghost Document records in database
- ✅ Atomic operation ensures Document-Invoice relationship always valid
- ✅ Follows existing `SnapReceiptScreen` pattern (caches image URI, saves on submit)
- ⚠️ Trade-off: File reference lost if app crashes (acceptable - user can re-upload)

### Navigation Flow

1. **User opens InvoiceScreen** (via modal/navigation from `InvoiceListPage`)
2. **User selects action:**
   - **Upload PDF** 
     1. File picker opens → User selects PDF
     2. Validate file (PDF type, < 20MB)
     3. **Copy file to app's private storage** (e.g., `/app/Documents/invoices/invoice_<timestamp>.pdf`)
     4. **Cache file metadata in state** (new app-private uri, name, size)
     5. Navigate to `InvoiceForm` (create mode) with `pdfFile` prop
     6. User completes invoice details
     7. **On submit**: Create Document with app-private path → Create Invoice with `documentId` → Both saved atomically
     8. Close modal
   - **Manual Entry** 
     1. Navigate to `InvoiceForm` (create mode) without `pdfFile` prop
     2. User fills form → Submit → Create Invoice (no documentId)
     3. Close modal
3. **Cancel at any stage** → Close modal, no database writes

**Document-Invoice Atomic Save**:
```typescript
// InvoiceScreen.tsx - handleUploadPdf
const handleUploadPdf = async () => {
  const result = await filePicker.pickDocument();
  if (result.cancelled) return;
  
  // Validate file
  if (!result.type?.includes('pdf')) {
    Alert.alert('Invalid File', 'Please select a PDF file');
    return;
  }
  if (result.size > 20 * 1024 * 1024) {
    Alert.alert('File Too Large', 'PDF must be under 20MB');
    return;
  }
  
  // Copy to app private storage immediately
  const appUri = await fileSystem.copyToAppStorage(
    result.uri,
    `invoice_${Date.now()}.pdf`
  );
  
  // Cache metadata with app-private URI
  const pdfFile: PdfFileMetadata = {
    uri: appUri,              // App private storage path
    originalUri: result.uri,  // Original picker path (for reference)
    name: result.name,
    size: result.size,
    mimeType: 'application/pdf'
  };
  
  // Navigate to form with cached metadata
  navigateToInvoiceForm({ mode: 'create', pdfFile });
};

// InvoiceForm.tsx - handleSubmit
const handleSubmit = async (invoiceData) => {
  let documentId;
  
  // Save Document first if PDF was uploaded (file already in app storage)
  if (pdfFile) {
    const doc = DocumentEntity.create({
      type: 'invoice',
      filename: pdfFile.name,
      localPath: pdfFile.uri,  // Points to app private storage
      size: pdfFile.size,
      mimeType: pdfFile.mimeType || 'application/pdf',
      status: 'local-only'
    });
    await documentRepository.save(doc.data());
    documentId = doc.data().id;
  }
  
  // Create Invoice with documentId link
  await createInvoiceUseCase.execute({ ...invoiceData, documentId });
};
```

---

## Database Schema Changes

**No new tables required.** We will reuse the existing `documents` table and `invoices` table.

### Existing Schema (No Changes Needed)

```sql
-- documents table (EXISTING)
CREATE TABLE documents (
  local_id INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT UNIQUE NOT NULL,
  project_id TEXT,
  type TEXT,  -- 'invoice' for invoice PDFs
  title TEXT,
  filename TEXT,
  mime_type TEXT,
  size INTEGER,
  status TEXT DEFAULT 'local-only',
  local_path TEXT,
  cloud_url TEXT,
  -- ... other fields
);

-- invoices table (EXISTING - already has documentId field)
CREATE TABLE invoices (
  local_id INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT UNIQUE NOT NULL,
  document_id TEXT,  -- Links to documents.id (EXISTING FIELD)
  project_id TEXT,
  -- ... invoice fields
);
```

**Usage**:
- When uploading invoice PDF: Create `Document` with `type='invoice'`, save via `DocumentRepository`
- Link invoice to document: Set `invoice.documentId = document.id`
- No migration needed - schema already supports this pattern

---

## Implementation Plan (TDD Workflow)

### 0. Planning ✅
- [x] Capture design in `design/issue-78-invoice-screen-plan.md`
- [x] Define acceptance criteria
- [x] Sketch UI and API contracts

### 1. Design Abstractions (Interfaces/Ports)
- [ ] Create `IFilePickerAdapter.ts` in `src/infrastructure/files/`
- [ ] Create `IFileSystemAdapter.ts` in `src/infrastructure/files/` (file copy utility)
- [ ] Verify existing `DocumentRepository` interface supports invoice document workflow
- [ ] No schema changes needed (reusing existing `documents` table)

### 2. Write Failing Tests (Red)

**Unit Tests** (`__tests__/unit/InvoiceScreen.test.tsx`)
- [ ] Test: InvoiceScreen renders with two action buttons (Upload PDF, Manual Entry)
- [ ] Test: Upload PDF button triggers file picker and copies file to app storage
- [ ] Test: Upload PDF validates file type (reject non-PDF files)
- [ ] Test: Upload PDF validates file size (reject files > 20MB)
- [ ] Test: File copy failure shows error alert and does not navigate
- [ ] Test: Manual entry button navigates to InvoiceForm without pdfFile prop
- [ ] Test: File picker cancellation does not copy file or navigate

**Integration Tests** (`__tests__/integration/InvoiceScreen.integration.test.tsx`)
- [ ] Test: Upload PDF flow copies file to app storage and navigates to InvoiceForm with pdfFile prop
- [ ] Test: Copied PDF file exists in app private storage after upload
- [ ] Test: InvoiceForm receives pdfFile prop (app-private URI) and saves Document + Invoice atomically on submit
- [ ] Test: InvoiceForm with pdfFile creates Document with localPath pointing to app storage
- [ ] Test: User cancels InvoiceForm after PDF upload → Document/Invoice not created, but copied file remains in app storage
- [ ] Test: Manual entry flow (no pdfFile) creates Invoice without documentId
- [ ] Test: Document-Invoice link is valid after atomic save (documentId matches saved Document)
- [ ] Test: Saved Document's localPath points to accessible file in app storage

### 3. Implement Minimal Code (Green)
- [ ] Implement `MobileFilePickerAdapter` in `src/infrastructure/files/`
- [ ] Implement `MobileFileSystemAdapter` in `src/infrastructure/files/` (uses react-native-fs)
  - `copyToAppStorage()` - Copies file to app Documents directory
  - `getDocumentsDirectory()` - Returns app's private documents path
- [ ] Implement file validation utility (PDF type check, size < 20MB)
- [ ] Create `InvoiceScreen` component in `src/pages/invoices/`
  - After file picker selection, copy file to app storage immediately
  - Cache PDF file metadata (with app-private URI) in component state
  - Pass `pdfFile` metadata to InvoiceForm via navigation
- [ ] Update `InvoiceForm` to accept optional `pdfFile?: PdfFileMetadata` prop
  - On submit: If `pdfFile` exists, create Document with app-private path, then create Invoice with `documentId`
  - Display PDF filename/indicator when `pdfFile` is present
- [ ] Use existing `DrizzleDocumentRepository` for atomic Document save
- [ ] Wire navigation/modal triggering from `InvoiceListPage` (deferred per plan)

### 4. Refactor
- [ ] Extract repeated styling patterns
- [ ] Ensure consistent error handling across upload and manual flows
- [ ] Add inline documentation for public interfaces

### 5. PR & Review
- [ ] Open PR with failing test snapshots and implementation
- [ ] Link design doc and issue #78
- [ ] Request review

### 6. Merge & Summary
- [ ] Update `progress.md` with key decisions and trade-offs

---

## Test Acceptance Criteria

### AC1: InvoiceScreen Modal Renders with Two Actions
**Given** the InvoiceScreen is opened  
**When** the component mounts  
**Then** I should see:
- A title "Add Invoice"
- A button labeled "Upload Invoice PDF" with PDF/paperclip icon
- A separator text "Or enter manually"
- A button labeled "Enter Invoice Details" with edit icon
- A Cancel button

**Test**: `InvoiceScreen.test.tsx` → `renders with upload and manual entry actions`

---

### AC2: Upload Flow Copies PDF to App Storage and Opens InvoiceForm (No DB Write Yet)
**Given** the InvoiceScreen is open  
**When** I press "Upload Invoice PDF"  
**Then** the file picker adapter is invoked with PDF filter  
**And** upon file selection, file is validated (PDF type, < 20MB)  
**And** file is **immediately copied to app's private storage** (e.g., `/app/Documents/invoices/`)  
**And** file metadata (app-private uri, name, size) is cached in component state (**NOT saved to database**)  
**And** InvoiceForm is opened with `pdfFile` prop containing cached metadata  
**And** InvoiceForm displays the PDF filename as an indicator  
**And** copied PDF file persists in app storage even if original is deleted  

**Test**: `InvoiceScreen.integration.test.tsx` → `upload PDF copies to app storage and navigates with pdfFile prop`

---

### AC2b: InvoiceForm Saves Document + Invoice Atomically on Submit
**Given** InvoiceForm is open with a `pdfFile` prop (PDF already in app storage)  
**When** user completes invoice details and presses Submit  
**Then** a Document entity is created with `type='invoice'`, `localPath=pdfFile.uri` (app-private path)  
**And** Document is saved via `DocumentRepository.save()`  
**And** Invoice is created with `documentId` linking to the saved Document  
**And** both Document and Invoice exist in database with valid relationship  
**And** Document's `localPath` points to the copied file in app private storage  

**Test**: `InvoiceScreen.integration.test.tsx` → `InvoiceForm with pdfFile saves Document and Invoice atomically`

---

### AC2c: User Cancels InvoiceForm After PDF Upload → Zero DB Writes (File Remains)
**Given** InvoiceForm is open with a `pdfFile` prop (PDF was copied to app storage)  
**When** user presses Cancel before submitting  
**Then** no Document record is created in database  
**And** no Invoice record is created in database  
**And** cached file metadata is discarded  
**And** copied PDF file remains in app storage (orphaned, can be cleaned up later)  

**Test**: `InvoiceScreen.integration.test.tsx` → `cancel after PDF upload creates no ghost DB records`

**Note**: Orphaned files in app storage can be cleaned up via background job (future enhancement)

---

### AC3: Manual Entry Navigates to InvoiceForm
**Given** the InvoiceScreen is open  
**When** I press "Enter Invoice Details"  
**Then** the InvoiceForm is opened in create mode  
**And** the form is prepped for a new invoice (empty fields)  

**Test**: `InvoiceScreen.test.tsx` → `manual entry button triggers form navigation`

---

### AC4: Styling and Spacing Match Existing Screens
**Given** the InvoiceScreen and SnapReceiptScreen  
**When** comparing layout, spacing, and button styles  
**Then** the InvoiceScreen should use identical:
- Container padding and background colors
- Button height, border radius, and text styles
- Icon sizes and spacing
- Separator text styling

**Test**: Visual review + snapshot test comparing rendered components

---

### AC5: Unit and Integration Tests Cover Component Rendering and Action Flows
**Given** the test suite  
**When** running `npm test`  
**Then** all tests pass with coverage of:
- Component rendering (mount, props, state)
- File picker invocation and cancellation handling
- Document repository save and retrieve operations
- Navigation to InvoiceForm
- Error states (e.g., file picker failure, save failure)

**Test**: Run full suite and verify coverage > 80% for `InvoiceScreen.tsx`

---

## Files to Create/Modify

### New Files
- `src/pages/invoices/InvoiceScreen.tsx` - Main modal component (copies PDF, caches metadata in state)
- `src/infrastructure/files/IFilePickerAdapter.ts` - Interface
- `src/infrastructure/files/MobileFilePickerAdapter.ts` - Implementation using react-native-document-picker
- `src/infrastructure/files/IFileSystemAdapter.ts` - Interface
- `src/infrastructure/files/MobileFileSystemAdapter.ts` - Implementation using react-native-fs
- `src/utils/fileValidation.ts` - PDF validation utility (type check, size limit)
- `__tests__/unit/InvoiceScreen.test.tsx` - Unit tests
- `__tests__/integration/InvoiceScreen.integration.test.tsx` - Integration tests (file copy, atomic save)

### Modified Files
- `src/components/invoices/InvoiceForm.tsx` - Accept optional `pdfFile?: PdfFileMetadata` prop, save Document atomically on submit
- `src/pages/invoices/InvoiceListPage.tsx` - (Deferred) Add button/trigger to open InvoiceScreen modal

### Existing Files (No Changes)
- `src/domain/entities/Document.ts` - Already supports `type='invoice'` for PDFs
- `src/domain/repositories/DocumentRepository.ts` - Already has save/findById/update methods
- `src/infrastructure/repositories/DrizzleDocumentRepository.ts` - Already implemented
- `src/infrastructure/database/schema.ts` - Already has `documents` table with type field
- `src/domain/entities/Invoice.ts` - Already has `documentId?: string` field

### Reference Files
- `src/pages/receipts/SnapReceiptScreen.tsx` - Layout and behavior reference
- `src/components/invoices/InvoiceForm.tsx` - Manual entry form to integrate

---

## Dependencies

### New Packages Required
```bash
npm install react-native-document-picker
npm install react-native-fs
```

**Justification**: 
- `react-native-document-picker` - Standard library for file picking, supports PDF filtering, active maintenance
- `react-native-fs` - File system operations (copy, read, delete), widely used, supports iOS/Android

**Alternatives Considered**:
- `expo-document-picker` / `expo-file-system` - Not used because project uses bare React Native, not Expo
- Custom web view picker - Overly complex, poor UX
- Native modules - Too much boilerplate for simple file operations

---

## Open Questions

1. **Should uploaded PDFs be stored locally or uploaded to a remote storage (e.g., S3)?**
   - **Decision for v1**: Store URI locally in SQLite. Remote upload deferred to future enhancement.

2. **Do we need to validate file size/type before saving?**
   - **Decision**: Yes, validate MIME type is `application/pdf` and size < 20MB. Show error alert if validation fails.

3. **Should we support multiple documents per invoice?**
   - **Decision for v1**: One document per invoice. Future enhancement can add document array support.

4. **How should the modal be triggered from Dashboard screen**
   - **Decision**: when user clicks the "Add Invoice" AFB button on Dashboard screen.

---

## Risk & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| File picker permissions not granted | High | Show permission request alert with instructions, graceful fallback to manual entry |
| PDF files are large, slow to copy/process | Medium | Add file size validation (< 20MB), show loading indicator during file copy |
| File copy fails (storage full, permissions) | High | Catch errors, show alert, allow user to retry or use manual entry |
| Orphaned files in app storage (user cancels) | Low | Copied files remain in app storage. Future enhancement: background cleanup job to delete files not linked to Documents |
| Users delete original file expecting it's "uploaded" | Medium | **MITIGATED** - File is copied to app private storage immediately, original can be safely deleted |
| Users expect OCR/parsing immediately | Low | Clearly label as "Upload PDF" not "Scan PDF", defer parsing to future milestone |
| Navigation conflicts with existing modal patterns | Medium | Follow existing navigation patterns from SnapReceiptScreen and ensure modal stack is consistent |

---

## Definition of Done

- [ ] All acceptance criteria met
- [ ] Unit tests pass with > 80% coverage for InvoiceScreen
- [ ] Integration tests pass for file upload and manual entry flows
- [ ] Type checks pass (`npx tsc --noEmit`)
- [ ] Code reviewed and approved
- [ ] Design document updated with final implementation notes
- [ ] `progress.md` updated with summary

---

## Notes & Decisions

### Design Review (2026-02-18)

**Decision 1: Reuse Existing Document Entity Instead of Creating InvoiceDocument**

- **Context**: Initial design proposed creating a new `invoice_documents` table and `IDocumentRepository` interface
- **Change**: Will reuse existing `Document` entity and `DocumentRepository` interface
- **Rationale**: 
  - `Document` entity already has `type` field supporting 'invoice' value
  - `Invoice` entity already has `documentId` field for linking
  - Existing `DocumentRepository` interface has all needed methods (save, findById, update)
  - `DrizzleDocumentRepository` implementation already exists
  - No schema migration needed
  - Maintains consistency with existing document management patterns (receipts, plans, etc.)
- **Impact**:
  - Removed `invoice_documents` table from schema changes
  - Updated navigation flow: PDF upload → Create Document (type='invoice') → Pass documentId to InvoiceForm
  - Simplified implementation: no new repository or entity needed
  - Reduced test surface: reuse existing DocumentRepository integration tests

---

**Decision 2: Hybrid Approach - Cache File in Memory, Save Atomically on Submit**

- **Problem**: When PDF is uploaded but user cancels InvoiceForm before submitting, we create "ghost" Document records not linked to any Invoice
- **Options Considered**:
  1. Save Document immediately with `status='pending'` + garbage collection
  2. Cache file in memory, save on submit (no ghost records)
  3. Create draft Invoice immediately (Document always linked)
- **Decision**: **Hybrid Approach (Option 2)** - Cache file metadata in memory, save Document + Invoice atomically on submit
- **Additional Enhancement**: **Copy file to app private storage immediately** after selection (before caching)
- **Rationale**:
  - ✅ **Zero ghost records** - Database writes only happen when user confirms submit
  - ✅ **Atomic operation** - Document and Invoice created together in one transaction
  - ✅ **Follows existing pattern** - `SnapReceiptScreen` caches image URI and saves on form submit
  - ✅ **Simpler cleanup** - No garbage collection job or pending status needed
  - ✅ **Better testability** - Clear transaction boundaries, easy to verify no DB writes on cancel
  - ✅ **File persistence** - Copying to app storage ensures file survives even if user deletes original
  - ✅ **User expectation** - Users assume uploaded file is "in the app" and can safely delete original
  - ⚠️ **Trade-off**: Orphaned files in app storage if user cancels (can add cleanup job later)
- **Implementation**:
  - `InvoiceScreen`: File picker → Validate → **Copy to app storage** → Cache `{ uri (app path), name, size }` in state → Navigate to InvoiceForm with `pdfFile` prop
  - `InvoiceForm`: On submit → If `pdfFile` exists, create Document (with app-private path) first, then create Invoice with `documentId`
  - On cancel → Discard cached metadata, zero DB writes (file remains in app storage)
- **Impact**:
  - InvoiceForm needs `pdfFile?: PdfFileMetadata` prop (not `documentId`)
  - Document creation happens inside InvoiceForm submit handler, not InvoiceScreen
  - File copy happens in InvoiceScreen immediately after picker (before navigation)
  - New dependency: `react-native-fs` for file system operations
  - Tests verify: (1) PDF upload copies file + caches metadata, (2) Submit saves atomically, (3) Cancel creates no DB records but file remains
  - Aligns with existing Receipt workflow for consistency
  - Future enhancement: Background job to clean up orphaned files (files in app storage not linked to any Document)

---

*This section will be updated during implementation with additional decisions, trade-offs, and learnings.*

