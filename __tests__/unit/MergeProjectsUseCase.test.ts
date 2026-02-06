import { MergeProjectsUseCase } from '../../src/application/usecases/project/MergeProjectsUseCase';
import { ProjectRepository } from '../../src/domain/repositories/ProjectRepository';

describe('MergeProjectsUseCase (TDD)', () => {
  it('should load both projects and call repository to persist merged result', async () => {
    const mockRepo: Partial<ProjectRepository> = {
      findById: jest.fn()
        .mockResolvedValueOnce({ id: 't', name: 'Target' })
        .mockResolvedValueOnce({ id: 's', name: 'Source' }),
      save: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    };

    const usecase = new MergeProjectsUseCase(mockRepo as ProjectRepository);

    // This will fail until execute is implemented
    await usecase.execute('t', 's');

    expect((mockRepo.findById as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(2);
    expect((mockRepo.save as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(1);
  });
});
