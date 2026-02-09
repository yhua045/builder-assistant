PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_documents` (
	`local_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`project_id` text,
	`type` text,
	`title` text,
	`filename` text,
	`mime_type` text,
	`size` integer,
	`status` text DEFAULT 'local-only' NOT NULL,
	`local_path` text,
	`storage_key` text,
	`cloud_url` text,
	`uri` text,
	`issued_by` text,
	`issued_date` integer,
	`expires_at` integer,
	`notes` text,
	`tags` text,
	`ocr_text` text,
	`source` text,
	`uploaded_by` text,
	`uploaded_at` integer,
	`checksum` text,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
INSERT INTO `__new_documents`("local_id", "id", "project_id", "type", "title", "filename", "mime_type", "size", "status", "local_path", "storage_key", "cloud_url", "uri", "issued_by", "issued_date", "expires_at", "notes", "tags", "ocr_text", "source", "uploaded_by", "uploaded_at", "checksum", "created_at", "updated_at") SELECT "local_id", "id", "project_id", "type", "title", "filename", "mime_type", "size", "status", "local_path", "storage_key", "cloud_url", "uri", "issued_by", "issued_date", "expires_at", "notes", "tags", "ocr_text", "source", "uploaded_by", "uploaded_at", "checksum", "created_at", "updated_at" FROM `documents`;--> statement-breakpoint
DROP TABLE `documents`;--> statement-breakpoint
ALTER TABLE `__new_documents` RENAME TO `documents`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `documents_id_unique` ON `documents` (`id`);--> statement-breakpoint
CREATE INDEX `idx_documents_project` ON `documents` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_documents_status` ON `documents` (`status`);