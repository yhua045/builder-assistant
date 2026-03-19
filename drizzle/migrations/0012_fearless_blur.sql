CREATE TABLE `audit_logs` (
	`local_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`project_id` text NOT NULL,
	`task_id` text,
	`timestamp_utc` integer NOT NULL,
	`source` text NOT NULL,
	`action` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `audit_logs_id_unique` ON `audit_logs` (`id`);--> statement-breakpoint
CREATE INDEX `idx_audit_logs_project` ON `audit_logs` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_audit_logs_task` ON `audit_logs` (`task_id`);--> statement-breakpoint
CREATE INDEX `idx_audit_logs_ts` ON `audit_logs` (`timestamp_utc`);