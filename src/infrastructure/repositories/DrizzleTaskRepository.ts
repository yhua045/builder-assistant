import { Task } from '../../domain/entities/Task';
import { TaskRepository } from '../../domain/repositories/TaskRepository';
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
        is_scheduled, scheduled_at, due_date, assigned_to,
        status, priority, completed_date, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
}
