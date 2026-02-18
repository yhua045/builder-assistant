PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_tasks` (
	`local_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`project_id` text,
	`phase_id` text,
	`title` text NOT NULL,
	`description` text,
	`notes` text,
	`is_scheduled` integer DEFAULT false,
	`scheduled_at` integer,
	`due_date` integer,
	`assigned_to` text,
	`status` text DEFAULT 'pending',
	`priority` text,
	`completed_date` integer,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
INSERT INTO `__new_tasks`("local_id", "id", "project_id", "phase_id", "title", "description", "notes", "is_scheduled", "scheduled_at", "due_date", "assigned_to", "status", "priority", "completed_date", "created_at", "updated_at") SELECT "local_id", "id", "project_id", "phase_id", "title", "description", "notes", "is_scheduled", "scheduled_at", "due_date", "assigned_to", "status", "priority", "completed_date", "created_at", "updated_at" FROM `tasks`;--> statement-breakpoint
DROP TABLE `tasks`;--> statement-breakpoint
ALTER TABLE `__new_tasks` RENAME TO `tasks`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `tasks_id_unique` ON `tasks` (`id`);--> statement-breakpoint
CREATE INDEX `idx_tasks_project` ON `tasks` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_tasks_scheduled` ON `tasks` (`scheduled_at`);--> statement-breakpoint
CREATE INDEX `idx_tasks_status` ON `tasks` (`status`);