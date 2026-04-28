import { AddTaskDocumentUseCase } from '../../src/features/tasks/application/AddTaskDocumentUseCase';
import { DocumentRepository } from '../../src/domain/repositories/DocumentRepository';
import { IFileSystemAdapter } from '../../src/infrastructure/files/IFileSystemAdapter';

function makeMockDocumentRepo(overrides: Partial<DocumentRepository> = {}): DocumentRepository {
  return {
    save: jest.fn().mockResolvedValue(undefined),
    findById: jest.fn().mockResolvedValue(null),
    findAll: jest.fn().mockResolvedValue([]),
    findByProjectId: jest.fn().mockResolvedValue([]),
    findByTaskId: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    assignProject: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeMockFileSystem(overrides: Partial<IFileSystemAdapter> = {}): IFileSystemAdapter {
  return {
    copyToAppStorage: jest.fn().mockResolvedValue('/app/storage/my-file.pdf'),
    getDocumentsDirectory: jest.fn().mockResolvedValue('/app/storage'),
    exists: jest.fn().mockResolvedValue(true),
    deleteFile: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('AddTaskDocumentUseCase', () => {
  it('copies file to app storage and saves document with taskId', async () => {
    const docRepo = makeMockDocumentRepo();
    const fsAdapter = makeMockFileSystem({
      copyToAppStorage: jest.fn().mockResolvedValue('/app/storage/report.pdf'),
    });
    const uc = new AddTaskDocumentUseCase(docRepo, fsAdapter);

    const result = await uc.execute({
      taskId: 'task-1',
      sourceUri: 'file:///tmp/report.pdf',
      filename: 'report.pdf',
      mimeType: 'application/pdf',
      size: 12345,
    });

    expect(fsAdapter.copyToAppStorage).toHaveBeenCalledWith('file:///tmp/report.pdf', 'report.pdf');
    expect(docRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 'task-1',
        filename: 'report.pdf',
        localPath: '/app/storage/report.pdf',
        status: 'local-only',
        source: 'import',
      }),
    );
    expect(result.taskId).toBe('task-1');
    expect(result.status).toBe('local-only');
    expect(result.localPath).toBe('/app/storage/report.pdf');
  });

  it('sets source to import', async () => {
    const docRepo = makeMockDocumentRepo();
    const fsAdapter = makeMockFileSystem();
    const uc = new AddTaskDocumentUseCase(docRepo, fsAdapter);

    const result = await uc.execute({
      taskId: 'task-2',
      sourceUri: 'file:///tmp/photo.jpg',
      filename: 'photo.jpg',
    });

    expect(result.source).toBe('import');
  });

  it('propagates projectId when provided', async () => {
    const docRepo = makeMockDocumentRepo();
    const fsAdapter = makeMockFileSystem();
    const uc = new AddTaskDocumentUseCase(docRepo, fsAdapter);

    await uc.execute({
      taskId: 'task-3',
      projectId: 'proj-A',
      sourceUri: 'file:///tmp/plan.pdf',
      filename: 'plan.pdf',
    });

    expect(docRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'proj-A' }),
    );
  });

  it('throws if copyToAppStorage fails', async () => {
    const docRepo = makeMockDocumentRepo();
    const fsAdapter = makeMockFileSystem({
      copyToAppStorage: jest.fn().mockRejectedValue(new Error('Disk full')),
    });
    const uc = new AddTaskDocumentUseCase(docRepo, fsAdapter);

    await expect(
      uc.execute({ taskId: 'task-1', sourceUri: 'file:///tmp/a.pdf', filename: 'a.pdf' }),
    ).rejects.toThrow('Disk full');
    expect(docRepo.save).not.toHaveBeenCalled();
  });
});
