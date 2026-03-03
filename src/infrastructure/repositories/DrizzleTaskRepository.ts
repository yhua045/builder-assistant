import { Task } from '../../domain/entities/Task';
import { TaskRepository } from '../../domain/repositories/TaskRepository';
import { DelayReason } from '../../domain/entities/DelayReason';
import { getDatabase, initDatabase } from '../../infrastructure/database/connection';

export class DrizzleTaskRepository implements TaskRepository {
  private initialized = false;

  private async ensureInitialized() {
    if (this.initialized) return;
    await initDatabase();
    this.initialized = true;
  }

  private mapRowToEntity(row: any): Task {
    return {
      id: row.id,
      localId: row.local_id,
      projectId: row.project_id || undefined,
      title: row.title,
      description: row.description || undefined,
      notes: row.notes || undefined,
      isScheduled: Boolean(row.is_scheduled),
      scheduledAt: row.scheduled_at ? new Date(row.scheduled_at).toISOString() : undefined,
      dueDate: row.due_date ? new Date(row.due_date).toISOString() : undefined,
      assignedTo: row.assigned_to || undefined,
      subcontractorId: row.subcontractor_id || undefined,
      status: (row.status as Task['status']) || 'pending',
      priority: row.priority as Task['priority'] || undefined,
      completedAt: row.completed_date ? new Date(row.completed_date).toISOString() : undefined,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
    };
  }

  private mapToDb(task: Task) {
    return {
      id: task.id,
      project_id: task.projectId || null,
      title: task.title,
      description: task.description || null,
      notes: task.notes || null,
      is_scheduled: task.isScheduled ? 1 : 0,
      scheduled_at: task.scheduledAt ? new Date(task.scheduledAt).getTime() : null,
      due_date: task.dueDate ? new Date(task.dueDate).getTime() : null,
      assigned_to: task.assignedTo || null,
      subcontractor_id: task.subcontractorId || null,
      status: task.status || 'pending',
      priority: task.priority || null,
      completed_date: task.completedAt ? new Date(task.completedAt).getTime() : null,
      created_at: task.createdAt ? new Date(task.createdAt).getTime() : Date.now(),
      updated_at: Date.now(),
    };
  }

  async save(task: Task): Promise<void> {
    await this.ensureInitialized();
    const { db } = getDatabase();
    const existing = await this.findById(task.id);
    const values = this.mapToDb(task);

    if (existing) {
      await this.update(task);
      return;
    }

    await db.executeSql(
      `INSERT INTO tasks (
        id, project_id, title, description, notes,
        is_scheduled, scheduled_at, due_date, assigned_to, subcontractor_id,
        status, priority, completed_date, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      , [
        values.id,
        values.project_id,
        values.title,
        values.description,
        values.notes,
        values.is_scheduled,
        values.scheduled_at,
        values.due_date,
        values.assigned_to,
        values.subcontractor_id,
        values.status,
        values.priority,
        values.completed_date,
        values.created_at,
        values.updated_at,
      ]
    );
  }

  async findById(id: string): Promise<Task | null> {
    await this.ensureInitialized();
    const { db } = getDatabase();
    const [result] = await db.executeSql('SELECT * FROM tasks WHERE id = ?', [id]);
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows.item(0));
  }

  async findAll(): Promise<Task[]> {
    await this.ensureInitialized();
    const { db } = getDatabase();
    const [result] = await db.executeSql('SELECT * FROM tasks');
    const tasksList: Task[] = [];
    for (let i = 0; i < result.rows.length; i++) {
      tasksList.push(this.mapRowToEntity(result.rows.item(i)));
    }
    return tasksList;
  }

  async findByProjectId(projectId: string): Promise<Task[]> {
    await this.ensureInitialized();
    const { db } = getDatabase();
    const [result] = await db.executeSql('SELECT * FROM tasks WHERE project_id = ?', [projectId]);
    const tasksList: Task[] = [];
    for (let i = 0; i < result.rows.length; i++) {
      tasksList.push(this.mapRowToEntity(result.rows.item(i)));
    }
    return tasksList;
  }

  async findAdHoc(): Promise<Task[]> {
    await this.ensureInitialized();
    const { db } = getDatabase();
    const [result] = await db.executeSql('SELECT * FROM tasks WHERE project_id IS NULL');
    const tasksList: Task[] = [];
    for (let i = 0; i < result.rows.length; i++) {
      tasksList.push(this.mapRowToEntity(result.rows.item(i)));
    }
    return tasksList;
  }

  async findUpcoming(projectId?: string, daysAhead: number = 7): Promise<Task[]> {
    await this.ensureInitialized();
    const { db } = getDatabase();
    const now = Date.now();
    const future = now + (daysAhead * 24 * 60 * 60 * 1000);
    const params: Array<string | number> = [now, future];
    let sql = 'SELECT * FROM tasks WHERE due_date >= ? AND due_date <= ?';
    if (projectId) {
      sql += ' AND project_id = ?';
      params.push(projectId);
    }
    const [result] = await db.executeSql(sql, params);
    const tasksList: Task[] = [];
    for (let i = 0; i < result.rows.length; i++) {
      tasksList.push(this.mapRowToEntity(result.rows.item(i)));
    }
    return tasksList;
  }

  async update(task: Task): Promise<void> {
    await this.ensureInitialized();
    const { db } = getDatabase();
    const values = this.mapToDb(task);
    await db.executeSql(
      `UPDATE tasks SET
        project_id = ?,
        title = ?,
        description = ?,
        notes = ?,
        is_scheduled = ?,
        scheduled_at = ?,
        due_date = ?,
        assigned_to = ?,
        subcontractor_id = ?,
        status = ?,
        priority = ?,
        completed_date = ?,
        created_at = ?,
        updated_at = ?
      WHERE id = ?`,
      [
        values.project_id,
        values.title,
        values.description,
        values.notes,
        values.is_scheduled,
        values.scheduled_at,
        values.due_date,
        values.assigned_to,
        values.subcontractor_id,
        values.status,
        values.priority,
        values.completed_date,
        values.created_at,
        values.updated_at,
        values.id,
      ]
    );
  }

  async delete(id: string): Promise<void> {
    await this.ensureInitialized();
    const { db } = getDatabase();
    await db.executeSql('DELETE FROM tasks WHERE id = ?', [id]);
  }

  // ── Dependencies ───────────────────────────────────────────────────────────

  async addDependency(taskId: string, dependsOnTaskId: string): Promise<void> {
    await this.ensureInitialized();
    const { db } = getDatabase();
    await db.executeSql(
      `INSERT OR IGNORE INTO task_dependencies (task_id, depends_on_task_id, created_at)
       VALUES (?, ?, ?)`,
      [taskId, dependsOnTaskId, Date.now()],
    );
  }

  async removeDependency(taskId: string, dependsOnTaskId: string): Promise<void> {
    await this.ensureInitialized();
    const { db } = getDatabase();
    await db.executeSql(
      'DELETE FROM task_dependencies WHERE task_id = ? AND depends_on_task_id = ?',
      [taskId, dependsOnTaskId],
    );
  }

  async findDependencies(taskId: string): Promise<Task[]> {
    await this.ensureInitialized();
    const { db } = getDatabase();
    const [result] = await db.executeSql(
      `SELECT t.* FROM tasks t
       INNER JOIN task_dependencies td ON td.depends_on_task_id = t.id
       WHERE td.task_id = ?`,
      [taskId],
    );
    const tasks: Task[] = [];
    for (let i = 0; i < result.rows.length; i++) {
      tasks.push(this.mapRowToEntity(result.rows.item(i)));
    }
    return tasks;
  }

  async findDependents(taskId: string): Promise<Task[]> {
    await this.ensureInitialized();
    const { db } = getDatabase();
    const [result] = await db.executeSql(
      `SELECT t.* FROM tasks t
       INNER JOIN task_dependencies td ON td.task_id = t.id
       WHERE td.depends_on_task_id = ?`,
      [taskId],
    );
    const tasks: Task[] = [];
    for (let i = 0; i < result.rows.length; i++) {
      tasks.push(this.mapRowToEntity(result.rows.item(i)));
    }
    return tasks;
  }

  // ── Delay Reasons ──────────────────────────────────────────────────────────

  async addDelayReason(entry: Omit<DelayReason, 'id' | 'createdAt'>): Promise<DelayReason> {
    await this.ensureInitialized();
    const { db } = getDatabase();
    const id = `delay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = Date.now();

    await db.executeSql(
      `INSERT INTO task_delay_reasons
        (id, task_id, reason_type_id, notes, delay_duration_days, delay_date, actor, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        entry.taskId,
        entry.reasonTypeId,
        entry.notes || null,
        entry.delayDurationDays ?? null,
        entry.delayDate ? new Date(entry.delayDate).getTime() : null,
        entry.actor || null,
        now,
      ],
    );

    return {
      id,
      taskId: entry.taskId,
      reasonTypeId: entry.reasonTypeId,
      reasonTypeLabel: entry.reasonTypeLabel,
      notes: entry.notes,
      delayDurationDays: entry.delayDurationDays,
      delayDate: entry.delayDate,
      actor: entry.actor,
      createdAt: new Date(now).toISOString(),
    };
  }

  async removeDelayReason(delayReasonId: string): Promise<void> {
    await this.ensureInitialized();
    const { db } = getDatabase();
    await db.executeSql('DELETE FROM task_delay_reasons WHERE id = ?', [delayReasonId]);
  }

  async findDelayReasons(taskId: string): Promise<DelayReason[]> {
    await this.ensureInitialized();
    const { db } = getDatabase();
    const [result] = await db.executeSql(
      `SELECT tdr.*, drt.label AS reason_type_label
       FROM task_delay_reasons tdr
       LEFT JOIN delay_reason_types drt ON drt.id = tdr.reason_type_id
       WHERE tdr.task_id = ?
       ORDER BY tdr.created_at ASC`,
      [taskId],
    );
    const reasons: DelayReason[] = [];
    for (let i = 0; i < result.rows.length; i++) {
      const row = result.rows.item(i);
      reasons.push({
        id: row.id,
        taskId: row.task_id,
        reasonTypeId: row.reason_type_id,
        reasonTypeLabel: row.reason_type_label || undefined,
        notes: row.notes || undefined,
        delayDurationDays: row.delay_duration_days ?? undefined,
        delayDate: row.delay_date ? new Date(row.delay_date).toISOString() : undefined,
        actor: row.actor || undefined,
        createdAt: new Date(row.created_at).toISOString(),
      });
    }
    return reasons;
  }

  // ── Cascade Helpers ───────────────────────────────────────────────────────

  async deleteDependenciesByTaskId(taskId: string): Promise<void> {
    await this.ensureInitialized();
    const { db } = getDatabase();
    // Remove rows where this task is the dependent OR the dependency
    await db.executeSql(
      'DELETE FROM task_dependencies WHERE task_id = ? OR depends_on_task_id = ?',
      [taskId, taskId],
    );
  }

  async deleteDelayReasonsByTaskId(taskId: string): Promise<void> {
    await this.ensureInitialized();
    const { db } = getDatabase();
    await db.executeSql('DELETE FROM task_delay_reasons WHERE task_id = ?', [taskId]);
  }
}
