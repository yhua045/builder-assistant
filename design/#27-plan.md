# Plan for Issue #27: Document Repository & Storage Architecture

## Goals
1.  Establish `Document` as a comprehensive aggregate including metadata and storage details.
2.  Implement `DocumentStorageEngine` abstraction for pluggable storage (Local vs Cloud).
3.  Implement `DrizzleDocumentRepository` for metadata persistence.
4.  Update architectural diagrams/plans.

## 1. Domain Object & Interfaces

### Entity: `Document`
Update `src/domain/entities/Document.ts` to include:
-   `projectId`: string | undefined (Optional)
-   `status`: 'local-only' | 'upload-pending' | 'uploaded' | 'failed'
-   `storageKey`: string | undefined
-   `localPath`: string | undefined
-   `mimeType`: string
-   `size`: number
-   `filename`: string
-   Provenance fields: `source`, `uploadedBy`, `uploadedAt`, `checksum`.

### Repository Interface: `DocumentRepository`
Update `src/domain/repositories/DocumentRepository.ts`:
-   `save(document: Document): Promise<void>`
-   `findById(id: string): Promise<Document | null>`
-   `findByProjectId(projectId: string): Promise<Document[]>`
-   `findAll(filter?: DocumentFilter): Promise<Document[]>`
-   `delete(id: string): Promise<void>`
-   `assignProject(documentId: string, projectId: string): Promise<void>`

### Storage Interface: `DocumentStorageEngine`
Create `src/domain/services/DocumentStorageEngine.ts` (or `infrastructure/storage/` if strictly infra, but interface belongs in domain or gateway layer):
-   `saveFile(file: Blob | Buffer, pathOrKey?: string): Promise<{ key: string, path?: string }>`
-   `getFile(key: string): Promise<Blob | Buffer | null>`
-   `deleteFile(key: string): Promise<void>`
-   `getSignedUrl?(key: string): Promise<string>` (Optional for cloud)

## 2. Infrastructure Implementation

### Database Schema (Drizzle)
Update `src/infrastructure/database/schema.ts`:
-   `documents` table:
    -   `project_id`: make nullable.
    -   Add `filename`, `mime_type`, `size`, `tags` (json), `ocr_text`, `status`.
    -   Add `local_path`, `storage_key`, `cloud_url`.
    -   Add `checksum`, `uploaded_at`, `uploaded_by`, `source`.

### Storage Implementation
Create `src/infrastructure/storage/LocalDocumentStorageEngine.ts`.
-   Uses React Native File System (e.g., `react-native-fs` or `expo-file-system`) or Node `fs` depending on environment. Since this is likely a React Native project (implied by `App.tsx`, `android`, `ios`), I should use a library compatible with it, OR just mock it for now if I don't have the library installed.
-   *Note*: The workspace has `package.json`. Let's check dependencies.

### Repository Implementation
Create `src/infrastructure/repositories/DrizzleDocumentRepository.ts`.
-   Implements `DocumentRepository`.
-   Maps `Document` entity to/from Drizzle schema.

## 3. Dependency Injection
Update `src/infrastructure/repositories/index.ts` or `DI-container.md` to reflect where the new repository and storage engine are instantiated.

## 4. Testing
-   Unit tests for `DrizzleDocumentRepository` using an in-memory SQLite (if possible) or mocked Drizzle.
-   Integration tests for the Repository (using the `__tests__/integration` setup).

## Implementation Steps
1.  **Check Dependencies**: Check `package.json` for file system libraries.
2.  **Define Interfaces**: Update `Document`, `DocumentRepository`, create `DocumentStorageEngine`.
3.  **Update Schema**: Modify `schema.ts`.
4.  **Implement Storage**: Basic local storage implementation.
5.  **Implement Repository**: `DrizzleDocumentRepository`.
6.  **Tests**: Write integration test to verify CRUD.
