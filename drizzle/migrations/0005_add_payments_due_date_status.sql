PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_payments` (
	`local_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`project_id` text,
	`invoice_id` text,
	`amount` real NOT NULL,
	`currency` text,
	`payment_date` integer,
	`due_date` integer,
	`status` text,
	`payment_method` text,
	`reference` text,
	`notes` text,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
INSERT INTO `__new_payments`("local_id", "id", "project_id", "invoice_id", "amount", "currency", "payment_date", "due_date", "status", "payment_method", "reference", "notes", "created_at", "updated_at") SELECT "local_id", "id", "project_id", "invoice_id", "amount", "currency", "payment_date", NULL as "due_date", NULL as "status", "payment_method", "reference", "notes", "created_at", "updated_at" FROM `payments`;--> statement-breakpoint
DROP TABLE `payments`;--> statement-breakpoint
ALTER TABLE `__new_payments` RENAME TO `payments`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `payments_id_unique` ON `payments` (`id`);--> statement-breakpoint
CREATE INDEX `idx_payments_project` ON `payments` (`project_id`);
