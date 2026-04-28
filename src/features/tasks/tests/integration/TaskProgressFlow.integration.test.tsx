/**
 * Integration tests for the Progress Log add/edit/delete flow (Issue #133).
 *
 * Strategy: exercise use-case layer directly against InMemoryTaskRepository
 * to verify the full add → edit → delete lifecycle without needing a real DB.
 *
 * Run: npx jest __tests__/integration/TaskProgressFlow.integration.test.tsx
 */
import { AddProgressLogUseCase } from '../../application/AddProgressLogUseCase';
import { UpdateProgressLogUseCase } from '../../application/UpdateProgressLogUseCase';
import { DeleteProgressLogUseCase } from '../../application/DeleteProgressLogUseCase';
import { CreateTaskUseCase } from '../../application/CreateTaskUseCase';
import { Task } from '../../../../domain/entities/Task';
import { ProgressLog } from '../../../../domain/entities/ProgressLog';
import { DelayReason } from '../../../../domain/entities/DelayReason';
import { TaskRepository } from '../../../../domain/repositories/TaskRepository';

// ── In-memory repository ──────────────────────────────────────────────────────

class InMemoryTaskRepository implements TaskRepository {
  private tasks = new Map<string, Task>();
  private deps: { taskId: string; dependsOnTaskId: string }[] = [];
  private delays: DelayReason[] = [];
  private progressLogs: ProgressLog[] = [];
  private _nextId = 1;

  async save(task: Task): Promise<void> { this.tasks.set(task.id, { ...task }); }
  async findById(id: string): Promise<Task | null> { return this.tasks.get(id) ?? null; }
  async findAll(): Promise<Task[]> { return [...this.tasks.values()]; }
  async findByProjectId(pid: string): Promise<Task[]> {
    return [...this.tasks.values()].filter((t) => t.projectId === pid);
  }
  async findAdHoc(): Promise<Task[]> {
    return [...this.tasks.values()].filter((t) => !t.projectId);
  }
  async findUpcoming(): Promise<Task[]> { return []; }
  async update(task: Task): Promise<void> { this.tasks.set(task.id, { ...task }); }
  async delete(id: string): Promise<void> { this.tasks.delete(id); }

  async addDependency(taskId: string, dependsOnTaskId: string): Promise<void> {
    const exists = this.deps.some(
      (d) => d.taskId === taskId && d.dependsOnTaskId === dependsOnTaskId,
    );
    if (!exists) this.deps.push({ taskId, dependsOnTaskId });
  }
  async removeDependency(taskId: string, dependsOnTaskId: string): Promise<void> {
    this.deps = this.deps.filter(
      (d) => !(d.taskId === taskId && d.dependsOnTaskId === dependsOnTaskId),
    );
  }
  async findDependencies(taskId: string): Promise<Task[]> {
    const ids = this.deps.filter((d) => d.taskId === taskId).map((d) => d.dependsOnTaskId);
    return ids.map((id) => this.tasks.get(id)).filter(Boolean) as Task[];
  }
  async findDependents(dependsOnTaskId: string): Promise<Task[]> {
    const ids = this.deps
      .filter((d) => d.dependsOnTaskId === dependsOnTaskId)
      .map((d) => d.taskId);
    return ids.map((id) => this.tasks.get(id)).filter(Boolean) as Task[];
  }
  async findAllDependencies(
    projectId: string,
  ): Promise<{ taskId: string; dependsOnTaskId: string }[]> {
    const projectTaskIds = new Set(
      [...this.tasks.values()].filter((t) => t.projectId === projectId).map((t) => t.id),
    );
    return this.deps.filter((d) => projectTaskIds.has(d.taskId));
  }

  async addDelayReason(entry: Omit<DelayReason, 'id' | 'createdAt'>): Promise<DelayReason> {
    const dr: DelayReason = {
      ...entry,
      id: `dr_${this._nextId++}`,
      createdAt: new Date().toISOString(),
    };
    this.delays.push(dr);
    return dr;
  }
  async removeDelayReason(id: string): Promise<void> {
    this.delays = this.delays.filter((d) => d.id !== id);
  }
  async resolveDelayReason(): Promise<void> {}
  async findDelayReasons(taskId: string): Promise<DelayReason[]> {
    return this.delays.filter((d) => d.taskId === taskId);
  }
  async summarizeDelayReasons(): Promise<{ reasonTypeId: string; count: number }[]> { return []; }
  async deleteDependenciesByTaskId(taskId: string): Promise<void> {
    this.deps = this.deps.filter(
      (d) => d.taskId !== taskId && d.dependsOnTaskId !== taskId,
    );
  }
  async deleteDelayReasonsByTaskId(taskId: string): Promise<void> {
    this.delays = this.delays.filter((d) => d.taskId !== taskId);
  }

  async findProgressLogs(taskId: string): Promise<ProgressLog[]> {
    return this.progressLogs.filter((l) => l.taskId === taskId);
  }
  async addProgressLog(log: Omit<ProgressLog, 'id' | 'createdAt'>): Promise<ProgressLog> {
    const pl: ProgressLog = { ...log, id: `pl_${this._nextId++}`, createdAt: Date.now() };
    this.progressLogs.push(pl);
    return pl;
  }
  async updateProgressLog(
    logId: string,
    patch: Partial<Omit<ProgressLog, 'id' | 'taskId' | 'createdAt'>>,
  ): Promise<ProgressLog> {
    const idx = this.progressLogs.findIndex((l) => l.id === logId);
    if (idx === -1) throw new Error(`ProgressLog not found: ${logId}`);
    const updated = { ...this.progressLogs[idx], ...patch, updatedAt: Date.now() };
    this.progressLogs[idx] = updated;
    return updated;
  }
  async deleteProgressLog(logId: string): Promise<void> {
    this.progressLogs = this.progressLogs.filter((l) => l.id !== logId);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRepo() {
  return new InMemoryTaskRepository();
}

async function seedTask(repo: InMemoryTaskRepository): Promise<Task> {
  const uc = new CreateTaskUseCase(repo);
  return uc.execute({
    title: 'Test Task',
    status: 'pending',
    isScheduled: false,
    isCriticalPath: false,
  });
}

// ─────────────────────────────────────────────────────────────────────────────

describe('TaskProgressFlow integration', () => {
  it('adds an inspection log and finds it via findProgressLogs', async () => {
    const repo = makeRepo();
    const task = await seedTask(repo);
    const uc = new AddProgressLogUseCase(repo);

    const log = await uc.execute({
      taskId: task.id,
      logType: 'inspection',
      notes: 'Foundation checked',
      actor: 'Mike',
    });

    expect(log.id).toBeTruthy();
    expect(log.logType).toBe('inspection');
    expect(log.notes).toBe('Foundation checked');
    expect(log.actor).toBe('Mike');

    const all = await repo.findProgressLogs(task.id);
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(log.id);
  });

  it('adds a log with photo URIs and persists them', async () => {
    const repo = makeRepo();
    const task = await seedTask(repo);
    const uc = new AddProgressLogUseCase(repo);

    const photos = ['file:///tmp/photo1.jpg', 'file:///tmp/photo2.jpg'];
    const log = await uc.execute({ taskId: task.id, logType: 'info', photos });

    const all = await repo.findProgressLogs(task.id);
    expect(all[0].photos).toEqual(photos);
    expect(log.photos).toEqual(photos);
  });

  it('edits an existing log and reflects updated notes', async () => {
    const repo = makeRepo();
    const task = await seedTask(repo);
    const addUc = new AddProgressLogUseCase(repo);
    const updateUc = new UpdateProgressLogUseCase(repo);

    const log = await addUc.execute({
      taskId: task.id,
      logType: 'general',
      notes: 'Original note',
    });

    const updated = await updateUc.execute({
      logId: log.id,
      notes: 'Updated note',
    });

    expect(updated.notes).toBe('Updated note');
    expect(updated.logType).toBe('general'); // unchanged

    const all = await repo.findProgressLogs(task.id);
    expect(all[0].notes).toBe('Updated note');
  });

  it('deletes a log and removes it from findProgressLogs', async () => {
    const repo = makeRepo();
    const task = await seedTask(repo);
    const addUc = new AddProgressLogUseCase(repo);
    const deleteUc = new DeleteProgressLogUseCase(repo);

    const log = await addUc.execute({ taskId: task.id, logType: 'issue', notes: 'Bug found' });
    expect(await repo.findProgressLogs(task.id)).toHaveLength(1);

    await deleteUc.execute({ logId: log.id });
    expect(await repo.findProgressLogs(task.id)).toHaveLength(0);
  });

  it('findProgressLogs returns empty array before any logs are added', async () => {
    const repo = makeRepo();
    const task = await seedTask(repo);
    const all = await repo.findProgressLogs(task.id);
    expect(all).toHaveLength(0);
  });
});
