/**
 * TaskViewDTOs — Application-layer Data Transfer Objects for Task-related views.
 *
 * These DTOs are the strict boundary between the Application/Domain layer and the
 * UI layer. UI components and hooks MUST import these types instead of importing
 * Domain Entities directly.
 *
 * Mappers at the bottom of this file translate Domain Entities → View DTOs.
 * They are called exclusively within use cases (e.g., GetTaskDetailsUseCase).
 */

// ── Primitive type aliases (replace Task['status'] etc. in UI layer) ──────────

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'blocked' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskType = 'standard' | 'variation' | 'contract_work';
export type QuoteStatus = 'pending' | 'issued' | 'accepted' | 'rejected';
export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'overdue' | 'cancelled';
export type ProgressLogLogType =
  | 'info'
  | 'delay'
  | 'inspection'
  | 'general'
  | 'completion'
  | 'issue'
  | 'other';

// ── TaskViewDTO ───────────────────────────────────────────────────────────────

/** Flat view-ready representation of a Task for the UI layer. */
export interface TaskViewDTO {
  id: string;
  projectId?: string;
  title: string;
  description?: string;
  notes?: string;
  status: TaskStatus;
  priority?: TaskPriority;
  startDate?: string;
  dueDate?: string;
  subcontractorId?: string;
  quoteAmount?: number | null;
  quoteStatus?: QuoteStatus;
  quoteInvoiceId?: string | null;
  taskType?: TaskType;
  dependencies?: string[];
}

// ── NextInLineItemDTO ─────────────────────────────────────────────────────────

/** Slim task summary for "next-in-line" and dependency lists. */
export interface NextInLineItemDTO {
  id: string;
  title: string;
  status: TaskStatus;
}

// ── ProgressLogViewDTO ────────────────────────────────────────────────────────

/** View-ready representation of a ProgressLog. */
export interface ProgressLogViewDTO {
  id: string;
  taskId: string;
  logType: ProgressLogLogType;
  notes?: string;
  date?: number;
  actor?: string;
  photos?: string[];
  reasonTypeId?: string;
  delayDurationDays?: number;
  resolvedAt?: number;
  mitigationNotes?: string;
  createdAt: number;
  updatedAt?: number;
}

// ── DelayReasonViewDTO ────────────────────────────────────────────────────────

/** View-ready representation of a DelayReason. */
export interface DelayReasonViewDTO {
  id: string;
  taskId: string;
  reasonTypeId: string;
  reasonTypeLabel?: string;
  notes?: string;
  delayDurationDays?: number;
  delayDate?: string;
  actor?: string;
  resolvedAt?: string;
  mitigationNotes?: string;
  createdAt: string;
}

// ── DocumentViewDTO ───────────────────────────────────────────────────────────

/** View-ready representation of a Document attachment. */
export interface DocumentViewDTO {
  id: string;
  taskId?: string;
  title?: string;
  filename?: string;
  mimeType?: string;
  /** Resolved from localPath → cloudUrl → uri (in that priority order). */
  displayUri?: string;
  /** Derived: true when mimeType starts with "image/". */
  isImage: boolean;
}

// ── InvoiceViewDTO ────────────────────────────────────────────────────────────

/** View-ready representation of a linked Invoice. */
export interface InvoiceViewDTO {
  id: string;
  total: number;
  currency: string;
  status: InvoiceStatus;
  paymentStatus: 'unpaid' | 'partial' | 'paid' | 'failed';
  issuerName?: string;
  invoiceNumber?: string;
  externalReference?: string | null;
  externalId?: string | null;
  dateIssued?: string;
  issueDate?: string;
  dateDue?: string;
  dueDate?: string;
}

// ── TaskDetailViewDTO ─────────────────────────────────────────────────────────

/** Extends TaskViewDTO with hydrated relational data for the detail screen. */
export interface TaskDetailViewDTO extends TaskViewDTO {
  dependencyTasks: NextInLineItemDTO[];
  delayReasons: DelayReasonViewDTO[];
  progressLogs: ProgressLogViewDTO[];
  linkedQuotations: unknown[];
}

// ── Mapper functions ──────────────────────────────────────────────────────────
// These are pure functions — no side effects, no async, only data projection.
// They live here so each use case can import them; they MUST NOT be called from
// UI components or hooks directly.

import type { Task } from '../../../domain/entities/Task';
import type { Document } from '../../../domain/entities/Document';
import type { ProgressLog } from '../../../domain/entities/ProgressLog';
import type { Invoice } from '../../../domain/entities/Invoice';
import type { DelayReason } from '../../../domain/entities/DelayReason';
import type { TaskDetail } from './GetTaskDetailUseCase';

export function mapTaskToViewDTO(task: Task): TaskViewDTO {
  return {
    id: task.id,
    projectId: task.projectId,
    title: task.title,
    description: task.description,
    notes: task.notes,
    status: task.status,
    priority: task.priority,
    startDate: task.startDate,
    dueDate: task.dueDate,
    subcontractorId: task.subcontractorId,
    quoteAmount: task.quoteAmount ?? null,
    quoteStatus: task.quoteStatus,
    quoteInvoiceId: task.quoteInvoiceId ?? null,
    taskType: task.taskType,
    dependencies: task.dependencies,
  };
}

export function mapDocumentToViewDTO(doc: Document): DocumentViewDTO {
  const displayUri = doc.localPath ?? doc.cloudUrl ?? doc.uri;
  return {
    id: doc.id,
    taskId: doc.taskId,
    title: doc.title,
    filename: doc.filename,
    mimeType: doc.mimeType,
    displayUri,
    isImage: doc.mimeType?.startsWith('image/') ?? false,
  };
}

export function mapProgressLogToViewDTO(log: ProgressLog): ProgressLogViewDTO {
  return {
    id: log.id,
    taskId: log.taskId,
    logType: log.logType,
    notes: log.notes,
    date: log.date,
    actor: log.actor,
    photos: log.photos,
    reasonTypeId: log.reasonTypeId,
    delayDurationDays: log.delayDurationDays,
    resolvedAt: log.resolvedAt,
    mitigationNotes: log.mitigationNotes,
    createdAt: log.createdAt,
    updatedAt: log.updatedAt,
  };
}

export function mapDelayReasonToViewDTO(dr: DelayReason): DelayReasonViewDTO {
  return {
    id: dr.id,
    taskId: dr.taskId,
    reasonTypeId: dr.reasonTypeId,
    reasonTypeLabel: dr.reasonTypeLabel,
    notes: dr.notes,
    delayDurationDays: dr.delayDurationDays,
    delayDate: dr.delayDate,
    actor: dr.actor,
    resolvedAt: dr.resolvedAt,
    mitigationNotes: dr.mitigationNotes,
    createdAt: dr.createdAt,
  };
}

export function mapInvoiceToViewDTO(invoice: Invoice): InvoiceViewDTO {
  return {
    id: invoice.id,
    total: invoice.total,
    currency: invoice.currency,
    status: invoice.status,
    paymentStatus: invoice.paymentStatus,
    issuerName: invoice.issuerName,
    invoiceNumber: invoice.invoiceNumber,
    externalReference: invoice.externalReference,
    externalId: invoice.externalId,
    dateIssued: invoice.dateIssued,
    issueDate: invoice.issueDate,
    dateDue: invoice.dateDue,
    dueDate: invoice.dueDate,
  };
}

export function mapTaskDetailToViewDTO(taskDetail: TaskDetail): TaskDetailViewDTO {
  return {
    ...mapTaskToViewDTO(taskDetail),
    dependencyTasks: taskDetail.dependencyTasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
    })),
    delayReasons: taskDetail.delayReasons.map(mapDelayReasonToViewDTO),
    progressLogs: taskDetail.progressLogs.map(mapProgressLogToViewDTO),
    linkedQuotations: taskDetail.linkedQuotations,
  };
}
