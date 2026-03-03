import { Document } from '../../../domain/entities/Document';
import { DocumentEntity } from '../../../domain/entities/Document';
import { DocumentRepository } from '../../../domain/repositories/DocumentRepository';
import { IFileSystemAdapter } from '../../../infrastructure/files/IFileSystemAdapter';

export interface AddTaskDocumentInput {
  taskId: string;
  projectId?: string;
  sourceUri: string;
  filename: string;
  mimeType?: string;
  size?: number;
}

/**
 * Copies a file to app private storage and persists a Document record linked to the given task.
 * Does not perform OCR or upload — the document is created with status 'local-only'.
 */
export class AddTaskDocumentUseCase {
  constructor(
    private readonly documentRepository: DocumentRepository,
    private readonly fileSystem: IFileSystemAdapter,
  ) {}

  async execute(input: AddTaskDocumentInput): Promise<Document> {
    const localPath = await this.fileSystem.copyToAppStorage(input.sourceUri, input.filename);

    const docEntity = DocumentEntity.create({
      taskId: input.taskId,
      projectId: input.projectId,
      filename: input.filename,
      localPath,
      mimeType: input.mimeType,
      size: input.size,
      status: 'local-only',
      source: 'import',
    });

    const doc = docEntity.data();
    await this.documentRepository.save(doc);
    return doc;
  }
}
