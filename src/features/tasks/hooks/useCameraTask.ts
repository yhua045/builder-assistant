import { useCallback, useMemo } from 'react';
import { container } from 'tsyringe';
import '../../../infrastructure/di/registerServices';
import { TaskRepository } from '../../../domain/repositories/TaskRepository';
import { DocumentRepository } from '../../../domain/repositories/DocumentRepository';
import { ICameraService } from '../../../application/services/ICameraService';
import { IFileSystemAdapter } from '../../../infrastructure/files/IFileSystemAdapter';
import { CreateTaskFromPhotoUseCase } from '../application/CreateTaskFromPhotoUseCase';
import type { Task } from '../../../domain/entities/Task';

export interface UseCameraTaskReturn {
  /** Launches the camera and returns the captured local URI, or null if cancelled. */
  capturePhoto(options?: { quality?: number; maxWidth?: number; maxHeight?: number }): Promise<string | null>;
  /** Creates a task from an already-captured photo URI. */
  createFromPhoto(uri: string, projectId?: string): Promise<Task>;
}

/**
 * Hook that wires ICameraService → CreateTaskFromPhotoUseCase.
 * Accepts an optional cameraAdapter override for testing.
 */
export function useCameraTask(
  cameraAdapter?: ICameraService,
): UseCameraTaskReturn {
  const taskRepository = useMemo(() => {
    try { return container.resolve<TaskRepository>('TaskRepository'); } catch { return null; }
  }, []);
  const documentRepository = useMemo(() => {
    try { return container.resolve<DocumentRepository>('DocumentRepository'); } catch { return null; }
  }, []);
  const fileSystem = useMemo(() => {
    try { return container.resolve<IFileSystemAdapter>('FileSystemAdapter'); } catch { return null; }
  }, []);
  const camera = useMemo(() => {
    if (cameraAdapter) return cameraAdapter;
    try { return container.resolve<ICameraService>('CameraService'); } catch { return null; }
  }, [cameraAdapter]);

  const createUseCase = useMemo(
    () => {
      if (!taskRepository || !documentRepository || !fileSystem) return null;
      return new CreateTaskFromPhotoUseCase(taskRepository, documentRepository, fileSystem);
    },
    [taskRepository, documentRepository, fileSystem],
  );

  const capturePhoto = useCallback(
    async (options?: { quality?: number; maxWidth?: number; maxHeight?: number }): Promise<string | null> => {
      if (!camera) throw new Error('CameraService not registered');
      const result = await camera.capturePhoto({
        quality: options?.quality ?? 0.8,
        maxWidth: options?.maxWidth ?? 2048,
        maxHeight: options?.maxHeight ?? 2048,
      });
      if (result.cancelled) return null;
      return result.uri;
    },
    [camera],
  );

  const createFromPhoto = useCallback(
    async (uri: string, projectId?: string): Promise<Task> => {
      if (!createUseCase) throw new Error('CreateTaskFromPhotoUseCase dependencies not registered');
      return createUseCase.execute({ localUri: uri, projectId });
    },
    [createUseCase],
  );

  return { capturePhoto, createFromPhoto };
}
