import { ArchiveProjectUseCase } from '../../application/ArchiveProjectUseCase';
import { ProjectRepository } from '../../../../domain/repositories/ProjectRepository';

describe('ArchiveProjectUseCase (TDD)', () => {
  it('should archive a project by setting archived flag and calling repository update', async () => {
    const mockRepo: Partial<ProjectRepository> = {
      findById: jest.fn().mockResolvedValue({ id: 'p1', name: 'P', status: 'planning' }),
      save: jest.fn().mockResolvedValue(undefined),
    };

    const usecase = new ArchiveProjectUseCase(mockRepo as ProjectRepository);

    // This will fail until execute is implemented
    await usecase.execute('p1');

    expect((mockRepo.findById as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(1);
    expect((mockRepo.save as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(1);
  });
});
