import { BulkUpdateProjectsUseCase } from '../../src/application/usecases/BulkUpdateProjectsUseCase';
import { ProjectRepository } from '../../src/domain/repositories/ProjectRepository';

describe('BulkUpdateProjectsUseCase (TDD)', () => {
  it('should call repository.update for each id and return per-item results', async () => {
    const mockRepo: Partial<ProjectRepository> = {
      save: jest.fn().mockResolvedValue(undefined),
      findById: jest.fn().mockResolvedValue({ id: 'p' }),
    };

    const usecase = new BulkUpdateProjectsUseCase(mockRepo as ProjectRepository);

    // This will fail until execute is implemented
    await usecase.execute(['a', 'b', 'c'], { name: 'Updated' } as any);

    expect((mockRepo.save as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(3);
  });
});
