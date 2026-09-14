CREATE TABLE IF NOT EXISTS `knowledge_detail_runs` (
  `id` text PRIMARY KEY NOT NULL,
  `run_id` text NOT NULL,
  `stage` text NOT NULL,
  `status` text NOT NULL,
  `started_at` integer,
  `completed_at` integer,
  `items_total` integer,
  `items_processed` integer,
  `items_succeeded` integer,
  `items_failed` integer,
  `error_message` text,
  `retry_count` integer DEFAULT 0 NOT NULL,
  `checkpoint` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);

CREATE INDEX IF NOT EXISTS `idx_knowledge_detail_runs_run` ON `knowledge_detail_runs` (`run_id`);
CREATE INDEX IF NOT EXISTS `idx_knowledge_detail_runs_run_stage` ON `knowledge_detail_runs` (`run_id`,`stage`);