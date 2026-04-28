import { TaskRepository } from '../../../domain/repositories/TaskRepository';
import { BlockerBarResult, BlockerItem } from '../../../domain/entities/CockpitData';
import { Task } from '../../../domain/entities/Task';
import { computeBlockers } from './CockpitScorer';

export interface ProjectSummary {
  id: string;
  name: string;
}

/**
 * GetBlockerBarDataUseCase
 *
 * Determines which project should power the Blocker Bar on the Task Cockpit.
 *
 * Algorithm:
 *   1. Iterate `orderedProjects` in the supplied order.
 *   2. Compute blockers for each project using the same CockpitScorer logic.
 *   3. Return the first project that has at least one active blocker.
 *   4. If no project has blockers, return `{ kind: 'winning' }`.
 *
 * The result is **read-only**: the app's persistent default project is unchanged.
 *
 * Performance note:
 *   Projects are queried sequentially and short-circuits on the first match,
 *   so typically only 1-2 DB reads are needed.
 */
export class GetBlockerBarDataUseCase {
  constructor(private readonly taskRepository: TaskRepository) {}

  async execute(
    orderedProjects: ProjectSummary[],
    now: Date = new Date(),
  ): Promise<BlockerBarResult> {
    for (const project of orderedProjects) {
      const blockers = await this._computeBlockersForProject(project.id, now);
      if (blockers.length > 0) {
        return {
          kind: 'blockers',
          projectId: project.id,
          projectName: project.name,
          blockers,
        };
      }
    }
    return { kind: 'winning' };
  }

  private async _computeBlockersForProject(projectId: string, now: Date): Promise<BlockerItem[]> {
    // ── 1. Load all tasks ─────────────────────────────────────────────────
    const allTasks = await this.taskRepository.findByProjectId(projectId);

    const activeTasks = allTasks.filter(
      (t: Task) => t.status !== 'completed' && t.status !== 'cancelled',
    );

    if (activeTasks.length === 0) return [];

    // ── 2. Load dependency edges ──────────────────────────────────────────
    const edges = await this.taskRepository.findAllDependencies(projectId);

    // ── 3. Build adjacency maps ───────────────────────────────────────────
    const taskMap = new Map<string, Task>(allTasks.map(t => [t.id, t]));
    const prereqsOf = new Map<string, string[]>();
    const dependentsOf = new Map<string, string[]>();

    for (const edge of edges) {
      if (!prereqsOf.has(edge.taskId)) prereqsOf.set(edge.taskId, []);
      prereqsOf.get(edge.taskId)!.push(edge.dependsOnTaskId);

      if (!dependentsOf.has(edge.dependsOnTaskId)) dependentsOf.set(edge.dependsOnTaskId, []);
      dependentsOf.get(edge.dependsOnTaskId)!.push(edge.taskId);
    }

    // ── 4. Compute blockers ───────────────────────────────────────────────
    return computeBlockers(activeTasks, taskMap, prereqsOf, dependentsOf, now);
  }
}
