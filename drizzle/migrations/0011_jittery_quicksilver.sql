CREATE TABLE `task_progress_logs` (
	`local_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`task_id` text NOT NULL,
	`log_type` text NOT NULL,
	`notes` text,
	`date` integer,
	`actor` text,
	`photos` text,
	`reason_type_id` text,
	`delay_duration_days` real,
	`resolved_at` integer,
	`mitigation_notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `task_progress_logs_id_unique` ON `task_progress_logs` (`id`);--> statement-breakpoint
CREATE INDEX `idx_progress_logs_task` ON `task_progress_logs` (`task_id`);--> statement-breakpoint
ALTER TABLE `invoices` ADD `task_id` text;--> statement-breakpoint
ALTER TABLE `invoices` ADD `quote_id` text;--> statement-breakpoint
CREATE INDEX `idx_invoices_task` ON `invoices` (`task_id`);--> statement-breakpoint
CREATE INDEX `idx_invoices_quote` ON `invoices` (`quote_id`);--> statement-breakpoint
ALTER TABLE `payments` ADD `contact_id` text;--> statement-breakpoint
ALTER TABLE `payments` ADD `contractor_name` text;--> statement-breakpoint
ALTER TABLE `payments` ADD `payment_category` text DEFAULT 'other';--> statement-breakpoint
ALTER TABLE `payments` ADD `stage_label` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `location` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `fire_zone` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `regulatory_flags` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `default_due_date_days` integer DEFAULT 5;--> statement-breakpoint
ALTER TABLE `quotations` ADD `task_id` text;--> statement-breakpoint
ALTER TABLE `quotations` ADD `document_id` text;--> statement-breakpoint
CREATE INDEX `idx_quotations_task` ON `quotations` (`task_id`);--> statement-breakpoint
ALTER TABLE `task_delay_reasons` ADD `log_type` text DEFAULT 'delay' NOT NULL;--> statement-breakpoint
ALTER TABLE `task_delay_reasons` ADD `resolved_at` integer;--> statement-breakpoint
ALTER TABLE `task_delay_reasons` ADD `mitigation_notes` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `photos` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `site_constraints` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `task_type` text DEFAULT 'variation';--> statement-breakpoint
ALTER TABLE `tasks` ADD `work_type` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `quote_amount` real;--> statement-breakpoint
ALTER TABLE `tasks` ADD `quote_status` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `quote_invoice_id` text;