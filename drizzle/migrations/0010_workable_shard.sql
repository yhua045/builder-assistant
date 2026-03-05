CREATE TABLE `delay_reason_types` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`display_order` integer NOT NULL,
	`is_active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `task_delay_reasons` (
	`local_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`task_id` text NOT NULL,
	`reason_type_id` text NOT NULL,
	`notes` text,
	`delay_duration_days` real,
	`delay_date` integer,
	`actor` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `task_delay_reasons_id_unique` ON `task_delay_reasons` (`id`);--> statement-breakpoint
CREATE INDEX `idx_task_delays_task` ON `task_delay_reasons` (`task_id`);--> statement-breakpoint
CREATE TABLE `task_dependencies` (
	`local_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task_id` text NOT NULL,
	`depends_on_task_id` text NOT NULL,
	`created_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_task_deps_task` ON `task_dependencies` (`task_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_task_deps_unique` ON `task_dependencies` (`task_id`,`depends_on_task_id`);--> statement-breakpoint
ALTER TABLE `properties` ADD `latitude` real;--> statement-breakpoint
ALTER TABLE `properties` ADD `longitude` real;--> statement-breakpoint
ALTER TABLE `tasks` ADD `subcontractor_id` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `is_critical_path` integer DEFAULT false;