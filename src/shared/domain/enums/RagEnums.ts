export enum ProjectDocumentKind {
  PDF = 'pdf',
  IMAGE = 'image',
  TEXT = 'text',
  EMAIL = 'email',
  SPREADSHEET = 'spreadsheet',
  OTHER = 'other',
}

export enum ProjectDocumentStatus {
  UPLOADED = 'uploaded',
  QUEUED = 'queued',
  PROCESSING = 'processing',
  READY = 'ready',
  FAILED = 'failed',
}

export enum AnalysisStatusValue {
  QUEUED = 'queued',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum AnalysisCheckpointTypeValue {
  STARTED = 'started',
  DOCUMENT_EXTRACTED = 'document_extracted',
  FACTS_GENERATED = 'facts_generated',
  CONFIRMATIONS_UPDATED = 'confirmations_updated',
  COMPLETED = 'completed',
  ERROR = 'error',
}

export enum FactTypeValue {
  BUDGET = 'budget',
  SCHEDULE = 'schedule',
  SCOPE = 'scope',
  RISK = 'risk',
  REQUIREMENT = 'requirement',
  CONSTRAINT = 'constraint',
  ASSUMPTION = 'assumption',
  PROCUREMENT = 'procurement',
  QUALITY = 'quality',
  OTHER = 'other',
}

export enum FactStatusValue {
  PROPOSED = 'proposed',
  CONFIRMED = 'confirmed',
  REJECTED = 'rejected',
  STALE = 'stale',
}

export enum FactSourceTypeValue {
  DOCUMENT = 'document',
  CHUNK = 'chunk',
  FACT = 'fact',
  USER = 'user',
  EXTERNAL = 'external',
}

export enum FactConfirmationDecisionValue {
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  NEEDS_REVIEW = 'needs_review',
}
