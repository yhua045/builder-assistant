CREATE TABLE IF NOT EXISTS `project_facts` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL,
  `fact_type` text NOT NULL,
  `canonical_text` text NOT NULL,
  `normalized_text` text,
  `status` text NOT NULL,
  `confidence` real,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);

CREATE INDEX IF NOT EXISTS `idx_project_facts_project` ON `project_facts` (`project_id`);
CREATE INDEX IF NOT EXISTS `idx_project_facts_type` ON `project_facts` (`fact_type`);

CREATE TABLE IF NOT EXISTS `knowledge_chunks` (
  `id` text PRIMARY KEY NOT NULL,
  `document_id` text NOT NULL,
  `content` text NOT NULL,
  `chunk_index` integer NOT NULL,
  `token_count` integer,
  `start_offset` integer,
  `end_offset` integer,
  `metadata` text
);

CREATE INDEX IF NOT EXISTS `idx_knowledge_chunks_document` ON `knowledge_chunks` (`document_id`);
CREATE INDEX IF NOT EXISTS `idx_knowledge_chunks_index` ON `knowledge_chunks` (`chunk_index`);

CREATE TABLE IF NOT EXISTS `knowledge_embeddings` (
  `id` text PRIMARY KEY NOT NULL,
  `chunk_id` text NOT NULL,
  `vector` text NOT NULL,
  `dimension` integer NOT NULL,
  `provider` text,
  `model_version` text,
  `fingerprint` text,
  `created_at` integer NOT NULL
);

CREATE INDEX IF NOT EXISTS `idx_knowledge_embeddings_chunk` ON `knowledge_embeddings` (`chunk_id`);
CREATE INDEX IF NOT EXISTS `idx_knowledge_embeddings_provider` ON `knowledge_embeddings` (`provider`);
