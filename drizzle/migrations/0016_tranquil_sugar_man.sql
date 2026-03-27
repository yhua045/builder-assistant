ALTER TABLE `invoices` ADD `issuer_id` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `total_payments` real DEFAULT 0;--> statement-breakpoint
ALTER TABLE `projects` ADD `pending_payments` real DEFAULT 0;