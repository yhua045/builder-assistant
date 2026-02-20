import { sqliteTable, text, integer, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

// Projects Table
export const projects = sqliteTable('projects', {
  localId: integer('local_id').primaryKey({ autoIncrement: true }),
  id: text('id').notNull().unique(),
  propertyId: text('property_id'),
  ownerId: text('owner_id'),
  name: text('name').notNull(),
  description: text('description'),
  status: text('status', { 
    enum: ['planning', 'in_progress', 'on_hold', 'completed', 'cancelled'] 
  }).notNull(),
  startDate: integer('start_date'), // Unix timestamp (milliseconds)
  expectedEndDate: integer('expected_end_date'), // Unix timestamp
  budget: real('budget'),
  currency: text('currency'),
  meta: text('meta'), // JSON
  createdAt: integer('created_at'),
  updatedAt: integer('updated_at'),
}, (table) => ({
  propertyIdx: index('idx_projects_property').on(table.propertyId),
  ownerIdx: index('idx_projects_owner').on(table.ownerId),
  statusIdx: index('idx_projects_status').on(table.status),
}));

// Project Phases Table
export const projectPhases = sqliteTable('project_phases', {
  localId: integer('local_id').primaryKey({ autoIncrement: true }),
  id: text('id').notNull().unique(),
  projectId: text('project_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  startDate: integer('start_date'), // Unix timestamp
  endDate: integer('end_date'), // Unix timestamp
  dependencies: text('dependencies'), // JSON array of phase IDs
  isCompleted: integer('is_completed', { mode: 'boolean' }).default(false),
  materialsRequired: text('materials_required'), // JSON array of material IDs
}, (table) => ({
  projectIdx: index('idx_phases_project').on(table.projectId),
}));

// Materials Table
export const materials = sqliteTable('materials', {
  localId: integer('local_id').primaryKey({ autoIncrement: true }),
  id: text('id').notNull().unique(),
  projectId: text('project_id').notNull(),
  name: text('name').notNull(),
  quantity: real('quantity').notNull(),
  unit: text('unit').notNull(),
  unitCost: real('unit_cost').notNull(),
  supplier: text('supplier'),
  estimatedDeliveryDate: integer('estimated_delivery_date'), // Unix timestamp
}, (table) => ({
  projectIdx: index('idx_materials_project').on(table.projectId),
}));

// Properties Table
export const properties = sqliteTable('properties', {
  localId: integer('local_id').primaryKey({ autoIncrement: true }),
  id: text('id').notNull().unique(),
  street: text('street'),
  city: text('city'),
  state: text('state'),
  postalCode: text('postal_code'),
  country: text('country'),
  address: text('address'),
  propertyType: text('property_type', { 
    enum: ['residential', 'commercial', 'mixed'] 
  }),
  lotSize: real('lot_size'),
  lotSizeUnit: text('lot_size_unit'),
  yearBuilt: integer('year_built'),
  ownerId: text('owner_id'),
  meta: text('meta'), // JSON
  createdAt: integer('created_at'),
  updatedAt: integer('updated_at'),
});

// Contacts Table
export const contacts = sqliteTable('contacts', {
  localId: integer('local_id').primaryKey({ autoIncrement: true }),
  id: text('id').notNull().unique(),
  name: text('name').notNull(),
  roles: text('roles'), // JSON array of RoleType
  trade: text('trade'),
  phone: text('phone'),
  email: text('email'),
  address: text('address'),
  rate: real('rate'),
  notes: text('notes'),
  createdAt: integer('created_at'),
  updatedAt: integer('updated_at'),
});

// Expenses Table
export const expenses = sqliteTable('expenses', {
  localId: integer('local_id').primaryKey({ autoIncrement: true }),
  id: text('id').notNull().unique(),
  projectId: text('project_id').notNull(),
  sourceType: text('source_type'),
  sourceUri: text('source_uri'),
  rawText: text('raw_text'),
  vendorId: text('vendor_id'),
  amount: real('amount'),
  currency: text('currency'),
  date: integer('date'), // Unix timestamp
  category: text('category'),
  trade: text('trade'),
  confidence: real('confidence'),
  validatedByAi: integer('validated_by_ai', { mode: 'boolean' }).default(false),
  status: text('status', { 
    enum: ['draft', 'accepted', 'rejected'] 
  }),
  createdAt: integer('created_at'),
  updatedAt: integer('updated_at'),
}, (table) => ({
  projectIdx: index('idx_expenses_project').on(table.projectId),
}));

// Documents Table
export const documents = sqliteTable('documents', {
  localId: integer('local_id').primaryKey({ autoIncrement: true }),
  id: text('id').notNull().unique(),
  projectId: text('project_id'), // Optional
  taskId: text('task_id'),       // Optional link to a Task
  type: text('type'),
  title: text('title'),
  
  // File Metadata
  filename: text('filename'),
  mimeType: text('mime_type'),
  size: integer('size'), // in bytes
  
  // Storage & Sync
  status: text('status', { 
    enum: ['local-only', 'upload-pending', 'uploaded', 'failed'] 
  }).default('local-only').notNull(),
  localPath: text('local_path'),
  storageKey: text('storage_key'),
  cloudUrl: text('cloud_url'),
  
  // Legacy / Other
  uri: text('uri'), // Legacy, preserved but optional
  issuedBy: text('issued_by'),
  issuedDate: integer('issued_date'), // Unix timestamp
  expiresAt: integer('expires_at'), // Unix timestamp
  notes: text('notes'),
  
  // Provenance & Extra
  tags: text('tags'), // JSON array
  ocrText: text('ocr_text'),
  source: text('source'),
  uploadedBy: text('uploaded_by'),
  uploadedAt: integer('uploaded_at'),
  checksum: text('checksum'),

  createdAt: integer('created_at'),
  updatedAt: integer('updated_at'),
}, (table) => ({
  projectIdx: index('idx_documents_project').on(table.projectId),
  statusIdx: index('idx_documents_status').on(table.status),
}));

// Invoices Table
export const invoices = sqliteTable('invoices', {
  localId: integer('local_id').primaryKey({ autoIncrement: true }),
  id: text('id').notNull().unique(),
  projectId: text('project_id'), // Optional
  
  // External Keys
  externalId: text('external_id'),
  externalReference: text('external_reference'),
  
  // Participant Info
  issuerName: text('issuer_name'),
  issuerAddress: text('issuer_address'),
  issuerTaxId: text('issuer_tax_id'),
  recipientName: text('recipient_name'),
  recipientId: text('recipient_id'),
  
  // Financials
  total: real('total').notNull(),
  subtotal: real('subtotal'),
  tax: real('tax'),
  currency: text('currency').notNull().default('USD'),

  // Dates
  dateIssued: integer('date_issued'), 
  dateDue: integer('date_due'),
  paymentDate: integer('payment_date'),

  // Status
  status: text('status').notNull().default('draft'),
  paymentStatus: text('payment_status').default('unpaid'),

  // Content
  documentId: text('document_id'),
  lineItems: text('line_items'),
  tags: text('tags'),
  notes: text('notes'),
  metadata: text('metadata'),

  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
}, (table) => ({
  projectIdx: index('idx_invoices_project').on(table.projectId),
  externalKeyIdx: uniqueIndex('idx_invoices_external_key').on(table.externalId, table.externalReference),
  statusIdx: index('idx_invoices_status').on(table.status),
}));

// Payments Table
export const payments = sqliteTable('payments', {
  localId: integer('local_id').primaryKey({ autoIncrement: true }),
  id: text('id').notNull().unique(),
  projectId: text('project_id'),
  invoiceId: text('invoice_id'),
  amount: real('amount').notNull(),
  currency: text('currency'),
  paymentDate: integer('payment_date'), // Unix timestamp
  dueDate: integer('due_date'), // Unix timestamp for due date
  status: text('status', { enum: ['pending', 'settled'] }),
  paymentMethod: text('payment_method'),
  reference: text('reference'),
  notes: text('notes'),
  createdAt: integer('created_at'),
  updatedAt: integer('updated_at'),
}, (table) => ({
  projectIdx: index('idx_payments_project').on(table.projectId),
}));

// Milestones Table
export const milestones = sqliteTable('milestones', {
  localId: integer('local_id').primaryKey({ autoIncrement: true }),
  id: text('id').notNull().unique(),
  projectId: text('project_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  targetDate: integer('target_date'), // Unix timestamp
  isCompleted: integer('is_completed', { mode: 'boolean' }).default(false),
  completedDate: integer('completed_date'), // Unix timestamp
  createdAt: integer('created_at'),
  updatedAt: integer('updated_at'),
}, (table) => ({
  projectIdx: index('idx_milestones_project').on(table.projectId),
}));

// Tasks Table
export const tasks = sqliteTable('tasks', {
  localId: integer('local_id').primaryKey({ autoIncrement: true }),
  id: text('id').notNull().unique(),
  projectId: text('project_id'), // Made optional for ad-hoc tasks
  phaseId: text('phase_id'),
  title: text('title').notNull(),
  description: text('description'),
  notes: text('notes'),
  
  // Scheduling
  isScheduled: integer('is_scheduled', { mode: 'boolean' }).default(false),
  scheduledAt: integer('scheduled_at'), // Unix timestamp
  dueDate: integer('due_date'), // Unix timestamp

  assignedTo: text('assigned_to'),
  
  status: text('status', { 
    enum: ['pending', 'in_progress', 'completed', 'blocked', 'cancelled'] 
  }).default('pending'),
  
  priority: text('priority', { 
    enum: ['low', 'medium', 'high', 'urgent'] 
  }),
  
  completedDate: integer('completed_date'), // Unix timestamp
  createdAt: integer('created_at'),
  updatedAt: integer('updated_at'),
}, (table) => ({
  projectIdx: index('idx_tasks_project').on(table.projectId),
  scheduledIdx: index('idx_tasks_scheduled').on(table.scheduledAt),
  statusIdx: index('idx_tasks_status').on(table.status),
}));

// Inspections Table
export const inspections = sqliteTable('inspections', {
  localId: integer('local_id').primaryKey({ autoIncrement: true }),
  id: text('id').notNull().unique(),
  projectId: text('project_id').notNull(),
  inspectorId: text('inspector_id'),
  inspectionType: text('inspection_type'),
  scheduledDate: integer('scheduled_date'), // Unix timestamp
  completedDate: integer('completed_date'), // Unix timestamp
  status: text('status', { 
    enum: ['scheduled', 'passed', 'failed', 'cancelled'] 
  }),
  notes: text('notes'),
  createdAt: integer('created_at'),
  updatedAt: integer('updated_at'),
}, (table) => ({
  projectIdx: index('idx_inspections_project').on(table.projectId),
}));

// Change Orders Table
export const changeOrders = sqliteTable('change_orders', {
  localId: integer('local_id').primaryKey({ autoIncrement: true }),
  id: text('id').notNull().unique(),
  projectId: text('project_id').notNull(),
  description: text('description'),
  requestedBy: text('requested_by'),
  approvedBy: text('approved_by'),
  amountDelta: real('amount_delta'),
  status: text('status', { 
    enum: ['proposed', 'approved', 'rejected'] 
  }),
  createdAt: integer('created_at'),
  updatedAt: integer('updated_at'),
}, (table) => ({
  projectIdx: index('idx_change_orders_project').on(table.projectId),
}));

// Work Variations Table
export const workVariations = sqliteTable('work_variations', {
  localId: integer('local_id').primaryKey({ autoIncrement: true }),
  id: text('id').notNull().unique(),
  projectId: text('project_id').notNull(),
  description: text('description'),
  reason: text('reason'),
  costImpact: real('cost_impact'),
  timelineImpactDays: integer('timeline_impact_days'),
  status: text('status', { 
    enum: ['pending', 'approved', 'rejected'] 
  }),
  approvedDate: integer('approved_date'), // Unix timestamp
  createdAt: integer('created_at'),
  updatedAt: integer('updated_at'),
}, (table) => ({
  projectIdx: index('idx_work_variations_project').on(table.projectId),
}));

// Quotations Table
export const quotations = sqliteTable('quotations', {
  localId: integer('local_id').primaryKey({ autoIncrement: true }),
  id: text('id').notNull().unique(),
  reference: text('reference').notNull(),
  
  // Relations
  projectId: text('project_id'),
  vendorId: text('vendor_id'),
  
  // Metadata
  vendorName: text('vendor_name'),
  vendorAddress: text('vendor_address'),
  vendorEmail: text('vendor_email'),
  
  // Dates
  date: integer('date').notNull(), // Unix timestamp (milliseconds)
  expiryDate: integer('expiry_date'), // Unix timestamp (milliseconds)
  
  // Financials
  currency: text('currency').notNull().default('USD'),
  subtotal: real('subtotal'),
  taxTotal: real('tax_total'),
  total: real('total').notNull(),
  
  // Content
  lineItems: text('line_items'), // JSON array
  notes: text('notes'),
  
  // Status
  status: text('status', {
    enum: ['draft', 'sent', 'accepted', 'declined']
  }).notNull().default('draft'),
  
  // Audit
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
}, (table) => ({
  projectIdx: index('idx_quotations_project').on(table.projectId),
  vendorIdx: index('idx_quotations_vendor').on(table.vendorId),
  statusIdx: index('idx_quotations_status').on(table.status),
  dateIdx: index('idx_quotations_date').on(table.date),
}));
