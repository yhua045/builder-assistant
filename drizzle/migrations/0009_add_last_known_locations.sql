PRAGMA foreign_keys=OFF;

CREATE TABLE IF NOT EXISTS `last_known_locations` (
  `id` integer PRIMARY KEY AUTOINCREMENT,
  `latitude` real NOT NULL,
  `longitude` real NOT NULL,
  `accuracy_meters` real,
  `altitude` real,
  `timestamp` text NOT NULL,
  `saved_at` integer NOT NULL
);

CREATE INDEX IF NOT EXISTS `idx_last_known_locations_saved_at` ON `last_known_locations` (`saved_at`);

PRAGMA foreign_keys=ON;
