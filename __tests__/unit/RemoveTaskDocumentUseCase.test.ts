import { RemoveTaskDocumentUseCase } from '../../src/application/usecases/document/RemoveTaskDocumentUseCase';
import { DocumentRepository } from '../../src/domain/repositories/DocumentRepository';
import { IFileSystemAdapter } from '../../src/infrastructure/files/IFileSystemAdapter';
import { Document } from '../../src/domain/entities/Document';

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
    copyToAppStorage: jest.fn().mockResolvedValue('/app/storage/file.pdf'),
    getDocumentsDirectory: jest.fn().mockResolvedValue('/app/storage'),
    exists: jest.fn().mockResolvedValue(true),
    deleteFile: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

const sampleDoc: Document = {
  id: 'doc-1',
  filename: 'report.pdf',
  localPath: '/app/storage/report.pdf',
  status: 'local-only',
  taskId: 'task-1',
};

describe('RemoveTaskDocumentUseCase', () => {
  it('deletes the document from the repository', async () => {
    const repo = makeMockDocumentRepo({
      findById: jest.fn().mockResolvedValue(sampleDoc),
    });
    const fs = makeMockFileSystem();
    const uc = new RemoveTaskDocumentUseCase(repo, fs);

    await uc.execute('doc-1');

    expect(repo.delete).toHaveBeenCalledWith('doc-1');
  });

  it('deletes the local file when localPath is present', async () => {
    const repo = makeMockDocumentRepo({
      findById: jest.fn().mockResolvedValue(sampleDoc),
    });
    const fs = makeMockFileSystem();
    const uc = new RemoveTaskDocumentUseCase(repo, fs);

    await uc.execute('doc-1');

    expect(fs.deleteFile).toHaveBeenCalledWith('/app/storage/report.pdf');
  });

  it('skips deleteFile when doc has no localPath', async () => {
    const docWithoutPath: Document = { ...sampleDoc, localPath: undefined };
    const repo = makeMockDocumentRepo({
      findById: jest.fn().mockResolvedValue(docWithoutPath),
    });
    const fs = makeMockFileSystem();
    const uc = new RemoveTaskDocumentUseCase(repo, fs);

    await uc.execute('doc-1');

    expect(fs.deleteFile).not.toHaveBeenCalled();
    expect(repo.delete).toHaveBeenCalledWith('doc-1');
  });

  it('still deletes the repo record even if deleteFile throws (best-effort)', async () => {
    const repo = makeMockDocumentRepo({
      findById: jest.fn().mockResolvedValue(sampleDoc),
    });
    const fs = makeMockFileSystem({
      deleteFile: jest.fn().mockRejectedValue(new Error('File not found')),
    });
    const uc = new RemoveTaskDocumentUseCase(repo, fs);

    // Should not throw
    await expect(uc.execute('doc-1')).resolves.toBeUndefined();
    expect(repo.delete).toHaveBeenCalledWith('doc-1');
  });

  it('still deletes the repo record when doc is not found in the repository', async () => {
    const repo = makeMockDocumentRepo({
      findById: jest.fn().mockResolvedValue(null),
    });
    const fs = makeMockFileSystem();
    const uc = new RemoveTaskDocumentUseCase(repo, fs);

    await uc.execute('doc-missing');

    expect(fs.deleteFile).not.toHaveBeenCalled();
    expect(repo.delete).toHaveBeenCalledWith('doc-missing');
  });
});
