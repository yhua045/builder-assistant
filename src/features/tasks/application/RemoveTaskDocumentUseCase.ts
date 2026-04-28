import { DocumentRepository } from '../../../domain/repositories/DocumentRepository';
import { IFileSystemAdapter } from '../../../infrastructure/files/IFileSystemAdapter';

/**
 * Removes a Document record (and its local file if present) linked to a task.
 * Local file deletion is best-effort — a missing file does not cause the use-case to fail.
 */
export class RemoveTaskDocumentUseCase {
  constructor(
    private readonly documentRepository: DocumentRepository,
    private readonly fileSystem: IFileSystemAdapter,
  ) {}

  async execute(documentId: string): Promise<void> {
    const doc = await this.documentRepository.findById(documentId);

    if (doc?.localPath) {
      try {
        await this.fileSystem.deleteFile(doc.localPath);
      } catch {
        // Best-effort: file may have already been removed externally
      }
    }

    await this.documentRepository.delete(documentId);
  }
}
