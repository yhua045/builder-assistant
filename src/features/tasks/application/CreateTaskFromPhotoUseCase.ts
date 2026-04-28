import { Task, TaskEntity } from '../../../domain/entities/Task';
import { DocumentEntity } from '../../../domain/entities/Document';
import { TaskRepository } from '../../../domain/repositories/TaskRepository';
import { DocumentRepository } from '../../../domain/repositories/DocumentRepository';
import { IFileSystemAdapter } from '../../../infrastructure/files/IFileSystemAdapter';

export interface CreateTaskFromPhotoParams {
  /** Temporary file URI returned by the camera (in cache directory) */
  localUri: string;
  projectId?: string;
}

/**
 * Orchestrates immediate task creation from a captured photo.
 *
 * Flow:
 *  1. Generate a default task title and set dueDate to T+3 days.
 *  2. Copy the temp photo to permanent DocumentDirectoryPath storage.
 *  3. Save a Document record (type:'photo', source:'camera') linked to the task.
 *  4. Delete the original temp file.
 *  5. Return the created Task so the UI can navigate to TaskForm in edit mode.
 */
export class CreateTaskFromPhotoUseCase {
  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly documentRepository: DocumentRepository,
    private readonly fileSystem: IFileSystemAdapter,
  ) {}

  async execute(params: CreateTaskFromPhotoParams): Promise<Task> {
    const now = new Date();

    // 1. Build task with defaults
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + 3);

    const dateLabel = now.toLocaleDateString('en-AU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    const taskEntity = TaskEntity.create({
      title: `Task – ${dateLabel}`,
      status: 'pending',
      priority: 'medium',
      dueDate: dueDate.toISOString(),
      projectId: params.projectId,
    });
    const task = taskEntity.data();

    await this.taskRepository.save(task);

    // 2. Copy photo to permanent storage
    const ext = params.localUri.split('.').pop() ?? 'jpg';
    const destFilename = `task-attachments/${task.id}/${Date.now()}.${ext}`;
    const permanentUri = await this.fileSystem.copyToAppStorage(
      params.localUri,
      destFilename,
    );

    // 3. Save Document record linked to the task
    const docEntity = DocumentEntity.create({
      taskId: task.id,
      type: 'photo',
      source: 'camera',
      status: 'local-only',
      localPath: permanentUri,
      mimeType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
    });
    await this.documentRepository.save(docEntity.data());

    // 4. Delete the original temp file
    await this.fileSystem.deleteFile(params.localUri);

    return task;
  }
}
