CREATE TABLE `change_orders` (
	`local_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`project_id` text NOT NULL,
	`description` text,
	`requested_by` text,
	`approved_by` text,
	`amount_delta` real,
	`status` text,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `change_orders_id_unique` ON `change_orders` (`id`);--> statement-breakpoint
CREATE INDEX `idx_change_orders_project` ON `change_orders` (`project_id`);--> statement-breakpoint
CREATE TABLE `contacts` (
	`local_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`name` text NOT NULL,
	`roles` text,
	`trade` text,
	`phone` text,
	`email` text,
	`address` text,
	`rate` real,
	`notes` text,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `contacts_id_unique` ON `contacts` (`id`);--> statement-breakpoint
CREATE TABLE `documents` (
	`local_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`project_id` text NOT NULL,
	`type` text,
	`title` text,
	`uri` text,
	`issued_by` text,
	`issued_date` integer,
	`expires_at` integer,
	`notes` text,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `documents_id_unique` ON `documents` (`id`);--> statement-breakpoint
CREATE INDEX `idx_documents_project` ON `documents` (`project_id`);--> statement-breakpoint
CREATE TABLE `expenses` (
	`local_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`project_id` text NOT NULL,
	`source_type` text,
	`source_uri` text,
	`raw_text` text,
	`vendor_id` text,
	`amount` real,
	`currency` text,
	`date` integer,
	`category` text,
	`trade` text,
	`confidence` real,
	`validated_by_ai` integer DEFAULT false,
	`status` text,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `expenses_id_unique` ON `expenses` (`id`);--> statement-breakpoint
CREATE INDEX `idx_expenses_project` ON `expenses` (`project_id`);--> statement-breakpoint
CREATE TABLE `inspections` (
	`local_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`project_id` text NOT NULL,
	`inspector_id` text,
	`inspection_type` text,
	`scheduled_date` integer,
	`completed_date` integer,
	`status` text,
	`notes` text,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `inspections_id_unique` ON `inspections` (`id`);--> statement-breakpoint
CREATE INDEX `idx_inspections_project` ON `inspections` (`project_id`);--> statement-breakpoint
CREATE TABLE `invoices` (
	`local_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`project_id` text NOT NULL,
	`vendor_id` text,
	`invoice_number` text,
	`issued_date` integer,
	`due_date` integer,
	`amount` real,
	`currency` text,
	`status` text,
	`payment_terms` text,
	`notes` text,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_id_unique` ON `invoices` (`id`);--> statement-breakpoint
CREATE INDEX `idx_invoices_project` ON `invoices` (`project_id`);--> statement-breakpoint
CREATE TABLE `materials` (
	`local_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`quantity` real NOT NULL,
	`unit` text NOT NULL,
	`unit_cost` real NOT NULL,
	`supplier` text,
	`estimated_delivery_date` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `materials_id_unique` ON `materials` (`id`);--> statement-breakpoint
CREATE INDEX `idx_materials_project` ON `materials` (`project_id`);--> statement-breakpoint
CREATE TABLE `milestones` (
	`local_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`target_date` integer,
	`is_completed` integer DEFAULT false,
	`completed_date` integer,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `milestones_id_unique` ON `milestones` (`id`);--> statement-breakpoint
CREATE INDEX `idx_milestones_project` ON `milestones` (`project_id`);--> statement-breakpoint
CREATE TABLE `payments` (
	`local_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`project_id` text NOT NULL,
	`invoice_id` text,
	`amount` real NOT NULL,
	`currency` text,
	`payment_date` integer,
	`payment_method` text,
	`reference` text,
	`notes` text,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payments_id_unique` ON `payments` (`id`);--> statement-breakpoint
CREATE INDEX `idx_payments_project` ON `payments` (`project_id`);--> statement-breakpoint
CREATE TABLE `project_phases` (
	`local_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`start_date` integer,
	`end_date` integer,
	`dependencies` text,
	`is_completed` integer DEFAULT false,
	`materials_required` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_phases_id_unique` ON `project_phases` (`id`);--> statement-breakpoint
CREATE INDEX `idx_phases_project` ON `project_phases` (`project_id`);--> statement-breakpoint
CREATE TABLE `projects` (
	`local_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`property_id` text,
	`owner_id` text,
	`name` text NOT NULL,
	`description` text,
	`status` text NOT NULL,
	`start_date` integer,
	`expected_end_date` integer,
	`budget` real,
	`currency` text,
	`meta` text,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `projects_id_unique` ON `projects` (`id`);--> statement-breakpoint
CREATE INDEX `idx_projects_property` ON `projects` (`property_id`);--> statement-breakpoint
CREATE INDEX `idx_projects_owner` ON `projects` (`owner_id`);--> statement-breakpoint
CREATE INDEX `idx_projects_status` ON `projects` (`status`);--> statement-breakpoint
CREATE TABLE `properties` (
	`local_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`street` text,
	`city` text,
	`state` text,
	`postal_code` text,
	`country` text,
	`address` text,
	`property_type` text,
	`lot_size` real,
	`lot_size_unit` text,
	`year_built` integer,
	`owner_id` text,
	`meta` text,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `properties_id_unique` ON `properties` (`id`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`local_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`project_id` text NOT NULL,
	`phase_id` text,
	`title` text NOT NULL,
	`description` text,
	`assigned_to` text,
	`status` text,
	`priority` text,
	`due_date` integer,
	`completed_date` integer,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tasks_id_unique` ON `tasks` (`id`);--> statement-breakpoint
CREATE INDEX `idx_tasks_project` ON `tasks` (`project_id`);--> statement-breakpoint
CREATE TABLE `work_variations` (
	`local_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`project_id` text NOT NULL,
	`description` text,
	`reason` text,
	`cost_impact` real,
	`timeline_impact_days` integer,
	`status` text,
	`approved_date` integer,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `work_variations_id_unique` ON `work_variations` (`id`);--> statement-breakpoint
CREATE INDEX `idx_work_variations_project` ON `work_variations` (`project_id`);