CREATE TABLE `quotations` (
	`local_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`reference` text NOT NULL,
	`project_id` text,
	`vendor_id` text,
	`vendor_name` text,
	`vendor_address` text,
	`vendor_email` text,
	`date` integer NOT NULL,
	`expiry_date` integer,
	`currency` text DEFAULT 'USD' NOT NULL,
	`subtotal` real,
	`tax_total` real,
	`total` real NOT NULL,
	`line_items` text,
	`notes` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quotations_id_unique` ON `quotations` (`id`);--> statement-breakpoint
CREATE INDEX `idx_quotations_project` ON `quotations` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_quotations_vendor` ON `quotations` (`vendor_id`);--> statement-breakpoint
CREATE INDEX `idx_quotations_status` ON `quotations` (`status`);--> statement-breakpoint
CREATE INDEX `idx_quotations_date` ON `quotations` (`date`);--> statement-breakpoint
ALTER TABLE `payments` ADD `due_date` integer;--> statement-breakpoint
ALTER TABLE `payments` ADD `status` text;