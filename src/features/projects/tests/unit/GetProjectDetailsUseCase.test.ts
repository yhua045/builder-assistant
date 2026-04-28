import { GetProjectDetailsUseCase } from '../../application/GetProjectDetailsUseCase';
import { ProjectDetails } from '../../../../domain/entities/ProjectDetails';
import { ProjectStatus } from '../../../../domain/entities/Project';

describe('GetProjectDetailsUseCase', () => {
  it('returns project details from repository', async () => {
    const fakeDetails: ProjectDetails = {
      id: 'proj-1',
      ownerId: 'owner-1',
      propertyId: undefined,
      name: 'Test Project',
      status: ProjectStatus.IN_PROGRESS,
      materials: [],
      phases: [],
      owner: { id: 'owner-1', name: 'Owner Name' },
      upcomingTasks: [],
    };

    const repo = { findDetailsById: jest.fn().mockResolvedValue(fakeDetails) };

    const useCase = new GetProjectDetailsUseCase(repo as any);
    const result = await useCase.execute('proj-1');

    expect(result).toBe(fakeDetails);
    expect(repo.findDetailsById).toHaveBeenCalledWith('proj-1');
  });
});
