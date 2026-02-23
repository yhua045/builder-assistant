CREATE TABLE `last_known_locations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`latitude` real NOT NULL,
	`longitude` real NOT NULL,
	`accuracy_meters` real,
	`altitude` real,
	`timestamp` text NOT NULL,
	`saved_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `documents` ADD `task_id` text;