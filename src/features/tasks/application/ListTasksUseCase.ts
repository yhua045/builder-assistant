import { Task } from '../../../shared/domain/entities/Task';
import { TaskRepository } from '../../../shared/domain/repositories/TaskRepository';

export class ListTasksUseCase {
  constructor(private readonly taskRepository: TaskRepository) {}

  async execute(projectId?: string): Promise<Task[]> {
    if (projectId) {
      return this.taskRepository.findByProjectId(projectId);
    } else {
      return this.taskRepository.findAll();
    }
  }

  async executeAdHoc(): Promise<Task[]> {
      return this.taskRepository.findAdHoc();
  }
}
