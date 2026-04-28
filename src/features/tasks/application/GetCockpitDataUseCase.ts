import { TaskRepository } from '../../../domain/repositories/TaskRepository';
import { CockpitData } from '../../../domain/entities/CockpitData';
import { Task } from '../../../domain/entities/Task';
import { computeBlockers, computeFocus3 } from './CockpitScorer';

/**
 * GetCockpitDataUseCase
 *
 * Computes the cockpit view for a given project:
 *  - `blockers`: tasks that are blocked (manually or auto-derived from overdue prerequisites)
 *  - `focus3`:   top 3 non-completed tasks ranked by heuristic urgency score
 *
 * **Performance note**: all tasks for the project are loaded in two queries
 * (findByProjectId + findAllDependencies) and the rest is done in-memory.
 * This is acceptable for projects with up to ~300 tasks.
 */
export class GetCockpitDataUseCase {
  constructor(private readonly taskRepository: TaskRepository) {}

  async execute(projectId: string, now: Date = new Date()): Promise<CockpitData> {
    // ── 1. Load all tasks for the project ──────────────────────────────────
    const allTasks = await this.taskRepository.findByProjectId(projectId);

    // Filter to active (non-terminal) tasks for scoring
    const activeTasks = allTasks.filter(
      (t: Task) => t.status !== 'completed' && t.status !== 'cancelled',
    );

    if (activeTasks.length === 0) {
      return { blockers: [], focus3: [] };
    }

    // ── 2. Load all dependency edges in one batch query ─────────────────────
    const edges = await this.taskRepository.findAllDependencies(projectId);

    // ── 3. Build in-memory adjacency maps ────────────────────────────────────
    // taskMap: id → Task (includes completed tasks so prereq lookups work)
    const taskMap = new Map<string, Task>(allTasks.map(t => [t.id, t]));

    // prereqsOf[taskId]       = list of task IDs that task depends on
    // dependentsOf[prereqId]  = list of task IDs that depend on this task
    const prereqsOf = new Map<string, string[]>();
    const dependentsOf = new Map<string, string[]>();

    for (const edge of edges) {
      if (!prereqsOf.has(edge.taskId)) prereqsOf.set(edge.taskId, []);
      prereqsOf.get(edge.taskId)!.push(edge.dependsOnTaskId);

      if (!dependentsOf.has(edge.dependsOnTaskId)) dependentsOf.set(edge.dependsOnTaskId, []);
      dependentsOf.get(edge.dependsOnTaskId)!.push(edge.taskId);
    }

    // ── 4. Compute blockers ───────────────────────────────────────────────────
    const blockers = computeBlockers(activeTasks, taskMap, prereqsOf, dependentsOf, now);
    const blockerTaskIds = new Set(blockers.map(b => b.task.id));

    // ── 5. Compute Focus-3 ────────────────────────────────────────────────────
    const focus3 = computeFocus3(activeTasks, taskMap, dependentsOf, now, blockerTaskIds);

    return { blockers, focus3 };
  }
}
