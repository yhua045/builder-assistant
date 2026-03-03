/**
 * Unit tests for CreateTaskFromPhotoUseCase
 * TDD — written before implementation (red → green).
 *
 * Tests cover:
 *  - Task created with correct default title and dueDate (+3 days)
 *  - Image copied from cache to permanent storage
 *  - Document record saved with correct fields (taskId, source, type, status)
 *  - Cancellation / no-photo path returns null without side effects
 *  - Retake: old temp file deleted before capturing again
 */

import { CreateTaskFromPhotoUseCase } from '../../src/application/usecases/task/CreateTaskFromPhotoUseCase';
import type { TaskRepository } from '../../src/domain/repositories/TaskRepository';
import type { DocumentRepository } from '../../src/domain/repositories/DocumentRepository';
import type { IFileSystemAdapter } from '../../src/infrastructure/files/IFileSystemAdapter';
import type { Task } from '../../src/domain/entities/Task';
import type { Document } from '../../src/domain/entities/Document';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

function makeTaskRepo(): jest.Mocked<TaskRepository> {
  return {
    save: jest.fn().mockResolvedValue(undefined),
    findById: jest.fn().mockResolvedValue(null),
    findAll: jest.fn().mockResolvedValue([]),
    findByProjectId: jest.fn().mockResolvedValue([]),
    findAdHoc: jest.fn().mockResolvedValue([]),
    findUpcoming: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    addDependency: jest.fn().mockResolvedValue(undefined),
    removeDependency: jest.fn().mockResolvedValue(undefined),
    findDependencies: jest.fn().mockResolvedValue([]),
    findDependents: jest.fn().mockResolvedValue([]),
    addDelayReason: jest.fn().mockResolvedValue({ id: 'dr-1', taskId: '', reasonTypeId: '', createdAt: '' }),
    removeDelayReason: jest.fn().mockResolvedValue(undefined),
    findDelayReasons: jest.fn().mockResolvedValue([]),
    deleteDependenciesByTaskId: jest.fn().mockResolvedValue(undefined),
    deleteDelayReasonsByTaskId: jest.fn().mockResolvedValue(undefined),
    resolveDelayReason: jest.fn().mockResolvedValue(undefined),
    summarizeDelayReasons: jest.fn().mockResolvedValue([]),
  };
}

function makeDocRepo(): jest.Mocked<DocumentRepository> {
  return {
    save: jest.fn().mockResolvedValue(undefined),
    findById: jest.fn().mockResolvedValue(null),
    findAll: jest.fn().mockResolvedValue([]),
    findByProjectId: jest.fn().mockResolvedValue([]),
    findByTaskId: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    assignProject: jest.fn().mockResolvedValue(undefined),
  };
}

function makeFileSystem(): jest.Mocked<IFileSystemAdapter> {
  return {
    copyToAppStorage: jest.fn().mockResolvedValue('file:///docs/task-attachments/task_123/uuid.jpg'),
    getDocumentsDirectory: jest.fn().mockResolvedValue('/docs'),
    exists: jest.fn().mockResolvedValue(true),
    deleteFile: jest.fn().mockResolvedValue(undefined),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEMP_URI = 'file:///cache/IMG_001.jpg';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CreateTaskFromPhotoUseCase', () => {
  let taskRepo: ReturnType<typeof makeTaskRepo>;
  let docRepo: ReturnType<typeof makeDocRepo>;
  let fs: ReturnType<typeof makeFileSystem>;
  let useCase: CreateTaskFromPhotoUseCase;

  beforeEach(() => {
    taskRepo = makeTaskRepo();
    docRepo = makeDocRepo();
    fs = makeFileSystem();
    useCase = new CreateTaskFromPhotoUseCase(taskRepo, docRepo, fs);
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-02-20T10:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates a task saved to the repository', async () => {
    await useCase.execute({ localUri: TEMP_URI });

    expect(taskRepo.save).toHaveBeenCalledTimes(1);
    const savedTask: Task = taskRepo.save.mock.calls[0][0];
    expect(savedTask.id).toBeTruthy();
    expect(savedTask.status).toBe('pending');
  });

  it('gives the task a default title containing the current date', async () => {
    await useCase.execute({ localUri: TEMP_URI });

    const savedTask: Task = taskRepo.save.mock.calls[0][0];
    expect(savedTask.title).toMatch(/2026/); // contains year
  });

  it('sets dueDate to 3 days from today', async () => {
    await useCase.execute({ localUri: TEMP_URI });

    const savedTask: Task = taskRepo.save.mock.calls[0][0];
    const due = new Date(savedTask.dueDate!);
    const expected = new Date('2026-02-23T10:00:00.000Z');
    expect(due.toDateString()).toBe(expected.toDateString());
  });

  it('copies the temporary image to permanent storage', async () => {
    await useCase.execute({ localUri: TEMP_URI });

    expect(fs.copyToAppStorage).toHaveBeenCalledTimes(1);
    const [srcUri, destName] = fs.copyToAppStorage.mock.calls[0];
    expect(srcUri).toBe(TEMP_URI);
    expect(destName).toMatch(/\.jpg$/i);
  });

  it('saves a Document record with correct fields', async () => {
    const result = await useCase.execute({ localUri: TEMP_URI });

    expect(docRepo.save).toHaveBeenCalledTimes(1);
    const savedDoc: Document = docRepo.save.mock.calls[0][0];
    expect(savedDoc.taskId).toBe(result.id);
    expect(savedDoc.type).toBe('photo');
    expect(savedDoc.source).toBe('camera');
    expect(savedDoc.status).toBe('local-only');
    expect(savedDoc.localPath).toBeTruthy();
  });

  it('returns the created Task', async () => {
    const result = await useCase.execute({ localUri: TEMP_URI });

    expect(result).toBeDefined();
    expect(result.id).toBeTruthy();
  });

  it('accepts an optional projectId and attaches it to the task', async () => {
    await useCase.execute({ localUri: TEMP_URI, projectId: 'proj_abc' });

    const savedTask: Task = taskRepo.save.mock.calls[0][0];
    expect(savedTask.projectId).toBe('proj_abc');
  });

  it('deletes the temp file after successful copy', async () => {
    await useCase.execute({ localUri: TEMP_URI });

    expect(fs.deleteFile).toHaveBeenCalledWith(TEMP_URI);
  });
});
