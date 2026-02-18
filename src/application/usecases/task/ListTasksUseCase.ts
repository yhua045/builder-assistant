import { Task } from '../../../domain/entities/Task';
import { TaskRepository } from '../../../domain/repositories/TaskRepository';

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
