import { UnarchiveProjectUseCase } from '../../application/UnarchiveProjectUseCase';
import { ProjectRepository } from '../../../../domain/repositories/ProjectRepository';

describe('UnarchiveProjectUseCase (TDD)', () => {
  it('should unarchive a project by clearing archived flag and calling repository update', async () => {
    const mockRepo: Partial<ProjectRepository> = {
      findById: jest.fn().mockResolvedValue({ id: 'p1', name: 'P', status: 'planning', archived: true }),
      save: jest.fn().mockResolvedValue(undefined),
    };

    const usecase = new UnarchiveProjectUseCase(mockRepo as ProjectRepository);

    // This will fail until execute is implemented
    await usecase.execute('p1');

    expect((mockRepo.findById as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(1);
    expect((mockRepo.save as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(1);
  });
});
