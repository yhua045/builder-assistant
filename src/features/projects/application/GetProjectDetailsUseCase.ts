import { ProjectDetails } from '../../../shared/domain/entities/ProjectDetails';
import { ProjectRepository } from '../../../shared/domain/repositories/ProjectRepository';

export class GetProjectDetailsUseCase {
  constructor(private readonly repo: ProjectRepository) {}

  async execute(id: string): Promise<ProjectDetails | null> {
    return (await this.repo.findDetailsById(id)) as ProjectDetails | null;
  }
}
