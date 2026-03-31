import { TaskRepository } from '../../../domain/repositories/TaskRepository';
// Task type not required here

export interface AddTaskDependencyInput {
  taskId: string;
  dependsOnTaskId: string;
}

export class AddTaskDependencyUseCase {
  constructor(private readonly taskRepository: TaskRepository) {}

  async execute(input: AddTaskDependencyInput): Promise<void> {
    const { taskId, dependsOnTaskId } = input;

    // Reject self-dependency
    if (taskId === dependsOnTaskId) {
      throw new Error('Cannot add self-dependency');
    }

    // Validate both tasks exist
    const task = await this.taskRepository.findById(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }
    const depTask = await this.taskRepository.findById(dependsOnTaskId);
    if (!depTask) {
      throw new Error(`Dependency task not found: ${dependsOnTaskId}`);
    }

    // Check for circular dependency via BFS (max 10 hops)
    await this.checkCircular(dependsOnTaskId, taskId, 10);

    await this.taskRepository.addDependency(taskId, dependsOnTaskId);
  }

  /**
   * BFS: starting from `startId`, walk its dependencies up to `maxDepth` hops.
   * If we ever encounter `targetId`, it means adding this edge would create a cycle.
   */
  private async checkCircular(startId: string, targetId: string, maxDepth: number): Promise<void> {
    const visited = new Set<string>();
    let queue = [startId];
    let depth = 0;

    while (queue.length > 0 && depth < maxDepth) {
      const nextQueue: string[] = [];
      for (const currentId of queue) {
        if (visited.has(currentId)) continue;
        visited.add(currentId);

        const deps = await this.taskRepository.findDependencies(currentId);
        for (const dep of deps) {
          if (dep.id === targetId) {
            throw new Error('Circular dependency detected');
          }
          if (!visited.has(dep.id)) {
            nextQueue.push(dep.id);
          }
        }
      }
      queue = nextQueue;
      depth++;
    }
  }
}
