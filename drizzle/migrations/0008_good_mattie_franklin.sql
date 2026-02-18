PRAGMA foreign_keys=OFF;

CREATE TABLE `tasks_new` (
	`local_id` integer PRIMARY KEY AUTOINCREMENT,
	`id` text NOT NULL,
	`project_id` text,
	`phase_id` text,
	`title` text NOT NULL,
	`description` text,
	`notes` text,
	`is_scheduled` integer DEFAULT 0,
	`scheduled_at` integer,
	`due_date` integer,
	`assigned_to` text,
	`status` text DEFAULT 'pending',
	`priority` text,
	`completed_date` integer,
	`created_at` integer,
	`updated_at` integer
);

INSERT INTO `tasks_new` (`local_id`, `id`, `project_id`, `phase_id`, `title`, `description`, `assigned_to`, `status`, `priority`, `due_date`, `completed_date`, `created_at`, `updated_at`) 
SELECT `local_id`, `id`, `project_id`, `phase_id`, `title`, `description`, `assigned_to`, `status`, `priority`, `due_date`, `completed_date`, `created_at`, `updated_at` FROM `tasks`;

DROP TABLE `tasks`;

ALTER TABLE `tasks_new` RENAME TO `tasks`;

CREATE UNIQUE INDEX `tasks_id_unique` ON `tasks` (`id`);
CREATE INDEX `idx_tasks_project` ON `tasks` (`project_id`);
CREATE INDEX `idx_tasks_scheduled` ON `tasks` (`scheduled_at`);
CREATE INDEX `idx_tasks_status` ON `tasks` (`status`);

PRAGMA foreign_keys=ON;
