export type AuditLogSource =
  | 'Task Form'
  | 'Payment'
  | 'Dashboard'
  | string; // extensible for future sources

export interface AuditLog {
  id: string;
  localId?: number;           // SQLite autoincrement PK
  projectId: string;          // required FK → projects.id
  taskId?: string;            // optional FK → tasks.id
  timestampUtc: string;       // ISO 8601 UTC string (new Date().toISOString())
  source: AuditLogSource;     // which screen/feature fired the event
  action: string;             // human-readable description
}
