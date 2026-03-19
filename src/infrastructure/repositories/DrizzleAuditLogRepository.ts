import { AuditLog } from '../../domain/entities/AuditLog';
import { AuditLogRepository } from '../../domain/repositories/AuditLogRepository';
import { initDatabase } from '../database/connection';

export class DrizzleAuditLogRepository implements AuditLogRepository {
  private rowToEntity(row: any): AuditLog {
    return {
      id: row.id,
      localId: row.local_id,
      projectId: row.project_id,
      taskId: row.task_id ?? undefined,
      timestampUtc: new Date(row.timestamp_utc).toISOString(),
      source: row.source,
      action: row.action,
    };
  }

  async save(entry: AuditLog): Promise<void> {
    const { db } = await initDatabase();
    await db.executeSql(
      `INSERT INTO audit_logs (id, project_id, task_id, timestamp_utc, source, action)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        entry.id,
        entry.projectId,
        entry.taskId ?? null,
        new Date(entry.timestampUtc).getTime(),
        entry.source,
        entry.action,
      ],
    );
  }

  async findByProjectId(projectId: string): Promise<AuditLog[]> {
    const { db } = await initDatabase();
    const [res] = await db.executeSql(
      `SELECT * FROM audit_logs WHERE project_id = ? ORDER BY timestamp_utc DESC`,
      [projectId],
    );
    const items: AuditLog[] = [];
    for (let i = 0; i < res.rows.length; i++) {
      items.push(this.rowToEntity(res.rows.item(i)));
    }
    return items;
  }

  async findByTaskId(taskId: string): Promise<AuditLog[]> {
    const { db } = await initDatabase();
    const [res] = await db.executeSql(
      `SELECT * FROM audit_logs WHERE task_id = ? ORDER BY timestamp_utc DESC`,
      [taskId],
    );
    const items: AuditLog[] = [];
    for (let i = 0; i < res.rows.length; i++) {
      items.push(this.rowToEntity(res.rows.item(i)));
    }
    return items;
  }
}
