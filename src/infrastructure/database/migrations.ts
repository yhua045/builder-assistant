export type RNMigration = {
  tag: string;
  hash: string;
  folderMillis: number;
  sql: string[];
};

const rawMigration0000 = `CREATE TABLE \`change_orders\` (
\t\`local_id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
\t\`id\` text NOT NULL,
\t\`project_id\` text NOT NULL,
\t\`description\` text,
\t\`requested_by\` text,
\t\`approved_by\` text,
\t\`amount_delta\` real,
\t\`status\` text,
\t\`created_at\` integer,
\t\`updated_at\` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX \`change_orders_id_unique\` ON \`change_orders\` (\`id\`);--> statement-breakpoint
CREATE INDEX \`idx_change_orders_project\` ON \`change_orders\` (\`project_id\`);--> statement-breakpoint
CREATE TABLE \`contacts\` (
\t\`local_id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
\t\`id\` text NOT NULL,
\t\`name\` text NOT NULL,
\t\`roles\` text,
\t\`trade\` text,
\t\`phone\` text,
\t\`email\` text,
\t\`address\` text,
\t\`rate\` real,
\t\`notes\` text,
\t\`created_at\` integer,
\t\`updated_at\` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX \`contacts_id_unique\` ON \`contacts\` (\`id\`);--> statement-breakpoint
CREATE TABLE \`documents\` (
\t\`local_id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
\t\`id\` text NOT NULL,
	\`project_id\` text,
\t\`type\` text,
\t\`title\` text,
	\`filename\` text,
	\`mime_type\` text,
	\`size\` integer,
	\`status\` text DEFAULT 'local-only' NOT NULL,
	\`local_path\` text,
	\`storage_key\` text,
	\`cloud_url\` text,
	\`uri\` text,
	\`issued_by\` text,
	\`issued_date\` integer,
	\`expires_at\` integer,
	\`notes\` text,
	\`tags\` text,
	\`ocr_text\` text,
	\`source\` text,
	\`uploaded_by\` text,
	\`uploaded_at\` integer,
	\`checksum\` text,
\t\`created_at\` integer,
\t\`updated_at\` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX \`documents_id_unique\` ON \`documents\` (\`id\`);--> statement-breakpoint
CREATE INDEX \`idx_documents_project\` ON \`documents\` (\`project_id\`);--> statement-breakpoint
CREATE INDEX \`idx_documents_status\` ON \`documents\` (\`status\`);--> statement-breakpoint
CREATE TABLE \`expenses\` (
\t\`local_id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
\t\`id\` text NOT NULL,
\t\`project_id\` text NOT NULL,
\t\`source_type\` text,
\t\`source_uri\` text,
\t\`raw_text\` text,
\t\`vendor_id\` text,
\t\`amount\` real,
\t\`currency\` text,
\t\`date\` integer,
\t\`category\` text,
\t\`trade\` text,
\t\`confidence\` real,
\t\`validated_by_ai\` integer DEFAULT false,
\t\`status\` text,
\t\`created_at\` integer,
\t\`updated_at\` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX \`expenses_id_unique\` ON \`expenses\` (\`id\`);--> statement-breakpoint
CREATE INDEX \`idx_expenses_project\` ON \`expenses\` (\`project_id\`);--> statement-breakpoint
CREATE TABLE \`inspections\` (
\t\`local_id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
\t\`id\` text NOT NULL,
\t\`project_id\` text NOT NULL,
\t\`inspector_id\` text,
\t\`inspection_type\` text,
\t\`scheduled_date\` integer,
\t\`completed_date\` integer,
\t\`status\` text,
\t\`notes\` text,
\t\`created_at\` integer,
\t\`updated_at\` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX \`inspections_id_unique\` ON \`inspections\` (\`id\`);--> statement-breakpoint
CREATE INDEX \`idx_inspections_project\` ON \`inspections\` (\`project_id\`);--> statement-breakpoint
CREATE TABLE \`invoices\` (
\t\`local_id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
\t\`id\` text NOT NULL,
	\`project_id\` text,
	\`external_id\` text NOT NULL,
	\`external_reference\` text NOT NULL,
	\`issuer_name\` text,
	\`issuer_address\` text,
	\`issuer_tax_id\` text,
	\`recipient_name\` text,
	\`recipient_id\` text,
	\`total\` real NOT NULL,
	\`subtotal\` real,
	\`tax\` real,
	\`currency\` text DEFAULT 'USD' NOT NULL,
	\`date_issued\` integer,
	\`date_due\` integer,
	\`payment_date\` integer,
	\`status\` text DEFAULT 'draft' NOT NULL,
	\`payment_status\` text DEFAULT 'unpaid',
	\`document_id\` text,
	\`line_items\` text,
	\`tags\` text,
	\`notes\` text,
	\`metadata\` text,
	\`created_at\` integer NOT NULL,
	\`updated_at\` integer NOT NULL,
	\`deleted_at\` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX \`invoices_id_unique\` ON \`invoices\` (\`id\`);--> statement-breakpoint
CREATE INDEX \`idx_invoices_project\` ON \`invoices\` (\`project_id\`);--> statement-breakpoint
CREATE UNIQUE INDEX \`idx_invoices_external_key\` ON \`invoices\` (\`external_id\`,\`external_reference\`);--> statement-breakpoint
CREATE INDEX \`idx_invoices_status\` ON \`invoices\` (\`status\`);--> statement-breakpoint
CREATE TABLE \`materials\` (
\t\`local_id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
\t\`id\` text NOT NULL,
\t\`project_id\` text NOT NULL,
\t\`name\` text NOT NULL,
\t\`quantity\` real NOT NULL,
\t\`unit\` text NOT NULL,
\t\`unit_cost\` real NOT NULL,
\t\`supplier\` text,
\t\`estimated_delivery_date\` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX \`materials_id_unique\` ON \`materials\` (\`id\`);--> statement-breakpoint
CREATE INDEX \`idx_materials_project\` ON \`materials\` (\`project_id\`);--> statement-breakpoint
CREATE TABLE \`milestones\` (
\t\`local_id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
\t\`id\` text NOT NULL,
\t\`project_id\` text NOT NULL,
\t\`name\` text NOT NULL,
\t\`description\` text,
\t\`target_date\` integer,
\t\`is_completed\` integer DEFAULT false,
\t\`completed_date\` integer,
\t\`created_at\` integer,
\t\`updated_at\` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX \`milestones_id_unique\` ON \`milestones\` (\`id\`);--> statement-breakpoint
CREATE INDEX \`idx_milestones_project\` ON \`milestones\` (\`project_id\`);--> statement-breakpoint
CREATE TABLE \`payments\` (
\t\`local_id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
\t\`id\` text NOT NULL,
\t\`project_id\` text NOT NULL,
\t\`invoice_id\` text,
\t\`amount\` real NOT NULL,
\t\`currency\` text,
\t\`payment_date\` integer,
\t\`payment_method\` text,
\t\`reference\` text,
\t\`notes\` text,
\t\`created_at\` integer,
\t\`updated_at\` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX \`payments_id_unique\` ON \`payments\` (\`id\`);--> statement-breakpoint
CREATE INDEX \`idx_payments_project\` ON \`payments\` (\`project_id\`);--> statement-breakpoint
CREATE TABLE \`project_phases\` (
\t\`local_id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
\t\`id\` text NOT NULL,
\t\`project_id\` text NOT NULL,
\t\`name\` text NOT NULL,
\t\`description\` text,
\t\`start_date\` integer,
\t\`end_date\` integer,
\t\`dependencies\` text,
\t\`is_completed\` integer DEFAULT false,
\t\`materials_required\` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX \`project_phases_id_unique\` ON \`project_phases\` (\`id\`);--> statement-breakpoint
CREATE INDEX \`idx_phases_project\` ON \`project_phases\` (\`project_id\`);--> statement-breakpoint
CREATE TABLE \`projects\` (
\t\`local_id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
\t\`id\` text NOT NULL,
\t\`property_id\` text,
\t\`owner_id\` text,
\t\`name\` text NOT NULL,
\t\`description\` text,
\t\`status\` text NOT NULL,
\t\`start_date\` integer,
\t\`expected_end_date\` integer,
\t\`budget\` real,
\t\`currency\` text,
\t\`meta\` text,
\t\`created_at\` integer,
\t\`updated_at\` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX \`projects_id_unique\` ON \`projects\` (\`id\`);--> statement-breakpoint
CREATE INDEX \`idx_projects_property\` ON \`projects\` (\`property_id\`);--> statement-breakpoint
CREATE INDEX \`idx_projects_owner\` ON \`projects\` (\`owner_id\`);--> statement-breakpoint
CREATE INDEX \`idx_projects_status\` ON \`projects\` (\`status\`);--> statement-breakpoint
CREATE TABLE \`properties\` (
\t\`local_id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
\t\`id\` text NOT NULL,
\t\`street\` text,
\t\`city\` text,
\t\`state\` text,
\t\`postal_code\` text,
\t\`country\` text,
\t\`address\` text,
\t\`property_type\` text,
\t\`lot_size\` real,
\t\`lot_size_unit\` text,
\t\`year_built\` integer,
\t\`owner_id\` text,
\t\`meta\` text,
\t\`created_at\` integer,
\t\`updated_at\` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX \`properties_id_unique\` ON \`properties\` (\`id\`);--> statement-breakpoint
CREATE TABLE \`tasks\` (
\t\`local_id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
\t\`id\` text NOT NULL,
\t\`project_id\` text NOT NULL,
\t\`phase_id\` text,
\t\`title\` text NOT NULL,
\t\`description\` text,
\t\`assigned_to\` text,
\t\`status\` text,
\t\`priority\` text,
\t\`due_date\` integer,
\t\`completed_date\` integer,
\t\`created_at\` integer,
\t\`updated_at\` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX \`tasks_id_unique\` ON \`tasks\` (\`id\`);--> statement-breakpoint
CREATE INDEX \`idx_tasks_project\` ON \`tasks\` (\`project_id\`);--> statement-breakpoint
CREATE TABLE \`work_variations\` (
\t\`local_id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
\t\`id\` text NOT NULL,
\t\`project_id\` text NOT NULL,
\t\`description\` text,
\t\`reason\` text,
\t\`cost_impact\` real,
\t\`timeline_impact_days\` integer,
\t\`status\` text,
\t\`approved_date\` integer,
\t\`created_at\` integer,
\t\`updated_at\` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX \`work_variations_id_unique\` ON \`work_variations\` (\`id\`);--> statement-breakpoint
CREATE INDEX \`idx_work_variations_project\` ON \`work_variations\` (\`project_id\`);`;

const rawMigration0001 = `PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE \`__new_documents\` (
	\`local_id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	\`id\` text NOT NULL,
	\`project_id\` text,
	\`type\` text,
	\`title\` text,
	\`filename\` text,
	\`mime_type\` text,
	\`size\` integer,
	\`status\` text DEFAULT 'local-only' NOT NULL,
	\`local_path\` text,
	\`storage_key\` text,
	\`cloud_url\` text,
	\`uri\` text,
	\`issued_by\` text,
	\`issued_date\` integer,
	\`expires_at\` integer,
	\`notes\` text,
	\`tags\` text,
	\`ocr_text\` text,
	\`source\` text,
	\`uploaded_by\` text,
	\`uploaded_at\` integer,
	\`checksum\` text,
	\`created_at\` integer,
	\`updated_at\` integer
);
--> statement-breakpoint
INSERT INTO \`__new_documents\`("local_id", "id", "project_id", "type", "title", "filename", "mime_type", "size", "status", "local_path", "storage_key", "cloud_url", "uri", "issued_by", "issued_date", "expires_at", "notes", "tags", "ocr_text", "source", "uploaded_by", "uploaded_at", "checksum", "created_at", "updated_at") SELECT "local_id", "id", "project_id", "type", "title", "filename", "mime_type", "size", "status", "local_path", "storage_key", "cloud_url", "uri", "issued_by", "issued_date", "expires_at", "notes", "tags", "ocr_text", "source", "uploaded_by", "uploaded_at", "checksum", "created_at", "updated_at" FROM \`documents\`;--> statement-breakpoint
DROP TABLE \`documents\`;--> statement-breakpoint
ALTER TABLE \`__new_documents\` RENAME TO \`documents\`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX \`documents_id_unique\` ON \`documents\` (\`id\`);--> statement-breakpoint
CREATE INDEX \`idx_documents_project\` ON \`documents\` (\`project_id\`);--> statement-breakpoint
CREATE INDEX \`idx_documents_status\` ON \`documents\` (\`status\`);`;

const rawMigration0002 = `PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE \`__new_invoices\` (
	\`local_id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	\`id\` text NOT NULL,
	\`project_id\` text,
	\`external_id\` text NOT NULL,
	\`external_reference\` text NOT NULL,
	\`issuer_name\` text,
	\`issuer_address\` text,
	\`issuer_tax_id\` text,
	\`recipient_name\` text,
	\`recipient_id\` text,
	\`total\` real NOT NULL,
	\`subtotal\` real,
	\`tax\` real,
	\`currency\` text DEFAULT 'USD' NOT NULL,
	\`date_issued\` integer,
	\`date_due\` integer,
	\`payment_date\` integer,
	\`status\` text DEFAULT 'draft' NOT NULL,
	\`payment_status\` text DEFAULT 'unpaid',
	\`document_id\` text,
	\`line_items\` text,
	\`tags\` text,
	\`notes\` text,
	\`metadata\` text,
	\`created_at\` integer NOT NULL,
	\`updated_at\` integer NOT NULL,
	\`deleted_at\` integer
);
--> statement-breakpoint
INSERT INTO \`__new_invoices\`("local_id", "id", "project_id", "external_id", "external_reference", "issuer_name", "issuer_address", "issuer_tax_id", "recipient_name", "recipient_id", "total", "subtotal", "tax", "currency", "date_issued", "date_due", "payment_date", "status", "payment_status", "document_id", "line_items", "tags", "notes", "metadata", "created_at", "updated_at", "deleted_at") SELECT "local_id", "id", "project_id", "external_id", "external_reference", "issuer_name", "issuer_address", "issuer_tax_id", "recipient_name", "recipient_id", "total", "subtotal", "tax", "currency", "date_issued", "date_due", "payment_date", "status", "payment_status", "document_id", "line_items", "tags", "notes", "metadata", "created_at", "updated_at", "deleted_at" FROM \`invoices\`;--> statement-breakpoint
DROP TABLE \`invoices\`;--> statement-breakpoint
ALTER TABLE \`__new_invoices\` RENAME TO \`invoices\`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX \`invoices_id_unique\` ON \`invoices\` (\`id\`);--> statement-breakpoint
CREATE INDEX \`idx_invoices_project\` ON \`invoices\` (\`project_id\`);--> statement-breakpoint
CREATE UNIQUE INDEX \`idx_invoices_external_key\` ON \`invoices\` (\`external_id\`,\`external_reference\`);--> statement-breakpoint
CREATE INDEX \`idx_invoices_status\` ON \`invoices\` (\`status\`);`;

const rawMigration0003 = `PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE \`__new_invoices\` (
	\`local_id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	\`id\` text NOT NULL,
	\`project_id\` text,
	\`external_id\` text,
	\`external_reference\` text,
	\`issuer_name\` text,
	\`issuer_address\` text,
	\`issuer_tax_id\` text,
	\`recipient_name\` text,
	\`recipient_id\` text,
	\`total\` real NOT NULL,
	\`subtotal\` real,
	\`tax\` real,
	\`currency\` text DEFAULT 'USD' NOT NULL,
	\`date_issued\` integer,
	\`date_due\` integer,
	\`payment_date\` integer,
	\`status\` text DEFAULT 'draft' NOT NULL,
	\`payment_status\` text DEFAULT 'unpaid',
	\`document_id\` text,
	\`line_items\` text,
	\`tags\` text,
	\`notes\` text,
	\`metadata\` text,
	\`created_at\` integer NOT NULL,
	\`updated_at\` integer NOT NULL,
	\`deleted_at\` integer
);
--> statement-breakpoint
INSERT INTO \`__new_invoices\`("local_id", "id", "project_id", "external_id", "external_reference", "issuer_name", "issuer_address", "issuer_tax_id", "recipient_name", "recipient_id", "total", "subtotal", "tax", "currency", "date_issued", "date_due", "payment_date", "status", "payment_status", "document_id", "line_items", "tags", "notes", "metadata", "created_at", "updated_at", "deleted_at") SELECT "local_id", "id", "project_id", "external_id", "external_reference", "issuer_name", "issuer_address", "issuer_tax_id", "recipient_name", "recipient_id", "total", "subtotal", "tax", "currency", "date_issued", "date_due", "payment_date", "status", "payment_status", "document_id", "line_items", "tags", "notes", "metadata", "created_at", "updated_at", "deleted_at" FROM \`invoices\`;--> statement-breakpoint
DROP TABLE \`invoices\`;--> statement-breakpoint
ALTER TABLE \`__new_invoices\` RENAME TO \`invoices\`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX \`invoices_id_unique\` ON \`invoices\` (\`id\`);--> statement-breakpoint
CREATE INDEX \`idx_invoices_project\` ON \`invoices\` (\`project_id\`);--> statement-breakpoint
CREATE UNIQUE INDEX \`idx_invoices_external_key\` ON \`invoices\` (\`external_id\`,\`external_reference\`);--> statement-breakpoint
CREATE INDEX \`idx_invoices_status\` ON \`invoices\` (\`status\`);`;

const migrations: RNMigration[] = [
  {
    tag: '0000_slow_drax',
    hash: '0000_slow_drax',
    folderMillis: 1770083691891,
    sql: rawMigration0000
      .split('--> statement-breakpoint')
      .map((statement) => statement.trim())
      .filter(Boolean),
  },
  {
    tag: '0001_cultured_the_anarchist',
    hash: '0001_cultured_the_anarchist',
    folderMillis: 1770608567002,
    sql: rawMigration0001
      .split('--> statement-breakpoint')
      .map((statement) => statement.trim())
      .filter(Boolean),
  },
  {
    tag: '0002_faithful_molecule_man',
    hash: '0002_faithful_molecule_man',
    folderMillis: 1770677064775,
    sql: rawMigration0002
      .split('--> statement-breakpoint')
      .map((statement) => statement.trim())
      .filter(Boolean),
  },
  {
    tag: '0003_optional_invoice_external_keys',
    hash: '0003_optional_invoice_external_keys',
    folderMillis: 1770855200000,
    sql: rawMigration0003
      .split('--> statement-breakpoint')
      .map((statement) => statement.trim())
      .filter(Boolean),
  },
];

export function getBundledMigrations(): RNMigration[] {
  return migrations;
}
