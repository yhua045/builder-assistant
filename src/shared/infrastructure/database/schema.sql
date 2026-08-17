-- SQLite DDL Schema for Builder Assistant App
-- Uses INTEGER PRIMARY KEY for local IDs with UUID stored as id (unique)
-- Supports encrypted SQLite via SQLCipher when configured

-- Projects Table
CREATE TABLE IF NOT EXISTS projects (
  local_id INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  property_id TEXT,
  owner_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL CHECK(status IN ('planning', 'in_progress', 'on_hold', 'completed', 'cancelled')),
  start_date INTEGER, -- Unix timestamp (milliseconds)
  expected_end_date INTEGER, -- Unix timestamp
  budget REAL,
  currency TEXT,
  meta TEXT, -- JSON
  created_at INTEGER,
  updated_at INTEGER,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE SET NULL,
  FOREIGN KEY (owner_id) REFERENCES contacts(id) ON DELETE SET NULL
);

-- Project Phases Table
CREATE TABLE IF NOT EXISTS project_phases (
  local_id INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  start_date INTEGER, -- Unix timestamp
  end_date INTEGER, -- Unix timestamp
  dependencies TEXT, -- JSON array of phase IDs
  is_completed INTEGER DEFAULT 0, -- Boolean: 0 or 1
  materials_required TEXT, -- JSON array of material IDs
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Materials Table
CREATE TABLE IF NOT EXISTS materials (
  local_id INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit TEXT NOT NULL,
  unit_cost REAL NOT NULL,
  supplier TEXT,
  estimated_delivery_date INTEGER, -- Unix timestamp
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Properties Table
CREATE TABLE IF NOT EXISTS properties (
  local_id INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  street TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT,
  address TEXT,
  property_type TEXT CHECK(property_type IN ('residential', 'commercial', 'mixed')),
  lot_size REAL,
  lot_size_unit TEXT,
  year_built INTEGER,
  owner_id TEXT,
  meta TEXT, -- JSON
  created_at INTEGER,
  updated_at INTEGER,
  FOREIGN KEY (owner_id) REFERENCES contacts(id) ON DELETE SET NULL
);

-- Contacts Table
CREATE TABLE IF NOT EXISTS contacts (
  local_id INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  roles TEXT, -- JSON array of RoleType
  trade TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  rate REAL,
  notes TEXT,
  created_at INTEGER,
  updated_at INTEGER
);

-- Expenses Table
CREATE TABLE IF NOT EXISTS expenses (
  local_id INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  project_id TEXT NOT NULL,
  source_type TEXT,
  source_uri TEXT,
  raw_text TEXT,
  vendor_id TEXT,
  amount REAL,
  currency TEXT,
  date INTEGER, -- Unix timestamp
  category TEXT,
  trade TEXT,
  confidence REAL,
  validated_by_ai INTEGER DEFAULT 0,
  status TEXT CHECK(status IN ('draft', 'accepted', 'rejected')),
  created_at INTEGER,
  updated_at INTEGER,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (vendor_id) REFERENCES contacts(id) ON DELETE SET NULL
);

-- Documents Table
CREATE TABLE IF NOT EXISTS documents (
  local_id INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  project_id TEXT NOT NULL,
  type TEXT,
  title TEXT,
  uri TEXT,
  issued_by TEXT,
  issued_date INTEGER, -- Unix timestamp
  expires_at INTEGER, -- Unix timestamp
  notes TEXT,
  created_at INTEGER,
  updated_at INTEGER,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Invoices Table
CREATE TABLE IF NOT EXISTS invoices (
  local_id INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  project_id TEXT NOT NULL,
  vendor_id TEXT,
  invoice_number TEXT,
  issued_date INTEGER, -- Unix timestamp
  due_date INTEGER, -- Unix timestamp
  amount REAL,
  currency TEXT,
  status TEXT CHECK(status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  payment_terms TEXT,
  notes TEXT,
  created_at INTEGER,
  updated_at INTEGER,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (vendor_id) REFERENCES contacts(id) ON DELETE SET NULL
);

-- Payments Table
CREATE TABLE IF NOT EXISTS payments (
  local_id INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  project_id TEXT NOT NULL,
  invoice_id TEXT,
  amount REAL NOT NULL,
  currency TEXT,
  payment_date INTEGER, -- Unix timestamp
  payment_method TEXT,
  reference TEXT,
  notes TEXT,
  created_at INTEGER,
  updated_at INTEGER,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL
);

-- Milestones Table
CREATE TABLE IF NOT EXISTS milestones (
  local_id INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  target_date INTEGER, -- Unix timestamp
  is_completed INTEGER DEFAULT 0,
  completed_date INTEGER, -- Unix timestamp
  created_at INTEGER,
  updated_at INTEGER,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Tasks Table
CREATE TABLE IF NOT EXISTS tasks (
  local_id INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  project_id TEXT NOT NULL,
  phase_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  assigned_to TEXT,
  status TEXT CHECK(status IN ('pending', 'in_progress', 'completed', 'blocked')),
  priority TEXT CHECK(priority IN ('low', 'medium', 'high', 'urgent')),
  due_date INTEGER, -- Unix timestamp
  completed_date INTEGER, -- Unix timestamp
  created_at INTEGER,
  updated_at INTEGER,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (phase_id) REFERENCES project_phases(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_to) REFERENCES contacts(id) ON DELETE SET NULL
);

-- Inspections Table
CREATE TABLE IF NOT EXISTS inspections (
  local_id INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  project_id TEXT NOT NULL,
  inspector_id TEXT,
  inspection_type TEXT,
  scheduled_date INTEGER, -- Unix timestamp
  completed_date INTEGER, -- Unix timestamp
  status TEXT CHECK(status IN ('scheduled', 'passed', 'failed', 'cancelled')),
  notes TEXT,
  created_at INTEGER,
  updated_at INTEGER,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (inspector_id) REFERENCES contacts(id) ON DELETE SET NULL
);

-- Change Orders Table
CREATE TABLE IF NOT EXISTS change_orders (
  local_id INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  project_id TEXT NOT NULL,
  description TEXT,
  requested_by TEXT,
  approved_by TEXT,
  amount_delta REAL,
  status TEXT CHECK(status IN ('proposed', 'approved', 'rejected')),
  created_at INTEGER,
  updated_at INTEGER,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (requested_by) REFERENCES contacts(id) ON DELETE SET NULL,
  FOREIGN KEY (approved_by) REFERENCES contacts(id) ON DELETE SET NULL
);

-- Work Variations Table
CREATE TABLE IF NOT EXISTS work_variations (
  local_id INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  project_id TEXT NOT NULL,
  description TEXT,
  reason TEXT,
  cost_impact REAL,
  timeline_impact_days INTEGER,
  status TEXT CHECK(status IN ('pending', 'approved', 'rejected')),
  approved_date INTEGER, -- Unix timestamp
  created_at INTEGER,
  updated_at INTEGER,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_projects_property ON projects(property_id);
CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_phases_project ON project_phases(project_id);
CREATE INDEX IF NOT EXISTS idx_materials_project ON materials(project_id);
CREATE INDEX IF NOT EXISTS idx_expenses_project ON expenses(project_id);
CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project_id);
CREATE INDEX IF NOT EXISTS idx_invoices_project ON invoices(project_id);
CREATE INDEX IF NOT EXISTS idx_payments_project ON payments(project_id);
CREATE INDEX IF NOT EXISTS idx_milestones_project ON milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_inspections_project ON inspections(project_id);
CREATE INDEX IF NOT EXISTS idx_change_orders_project ON change_orders(project_id);
CREATE INDEX IF NOT EXISTS idx_work_variations_project ON work_variations(project_id);
