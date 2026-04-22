/**
 * GetTaskDetailsUseCase — Application-layer aggregation use case.
 *
 * Encapsulates all repository orchestration for loading a fully hydrated
 * Task Details view: task entity, rich task detail (deps/logs/quotations),
 * next-in-line dependents, linked documents, linked invoice or quotation
 * record, and resolved subcontractor contact.
 *
 * Design: design/issue-210-task-screens-refactor.md §4
 */

import { TaskRepository } from '../../../domain/repositories/TaskRepository';
import { DocumentRepository } from '../../../domain/repositories/DocumentRepository';
import { InvoiceRepository } from '../../../domain/repositories/InvoiceRepository';
import { QuotationRepository } from '../../../domain/repositories/QuotationRepository';
import { ContactRepository } from '../../../domain/repositories/ContactRepository';
import { TaskDetail } from './GetTaskDetailUseCase';
import {
  TaskViewDTO,
  TaskDetailViewDTO,
  NextInLineItemDTO,
  DocumentViewDTO,
  InvoiceViewDTO,
  mapTaskToViewDTO,
  mapTaskDetailToViewDTO,
  mapDocumentToViewDTO,
  mapInvoiceToViewDTO,
} from '../../dtos/TaskViewDTOs';

// ── Output types ──────────────────────────────────────────────────────────────

export interface SubcontractorInfo {
  id: string;
  name: string;
  trade?: string;
  phone?: string;
  email?: string;
}

export interface TaskDetailsDTO {
  task: TaskViewDTO;
  taskDetail: TaskDetailViewDTO;
  nextInLine: NextInLineItemDTO[];
  documents: DocumentViewDTO[];
  linkedInvoice: InvoiceViewDTO | null;
  hasQuotationRecord: boolean;
  subcontractorInfo: SubcontractorInfo | null;
}

// ── Use case ──────────────────────────────────────────────────────────────────

export class GetTaskDetailsUseCase {
  constructor(
    private readonly taskRepo: TaskRepository,
    private readonly documentRepo: DocumentRepository,
    private readonly invoiceRepo: InvoiceRepository,
    private readonly quotationRepo: QuotationRepository,
    private readonly contactRepo: ContactRepository,
  ) {}

  async execute(taskId: string): Promise<TaskDetailsDTO | null> {
    const task = await this.taskRepo.findById(taskId);
    if (!task) return null;

    // Fetch all parallel data in a single round
    const [
      dependencyTasks,
      delayReasons,
      progressLogs,
      linkedQuotations,
      dependents,
      documents,
    ] = await Promise.all([
      this.taskRepo.findDependencies(taskId),
      this.taskRepo.findDelayReasons(taskId),
      this.taskRepo.findProgressLogs(taskId),
      this.quotationRepo.findByTask(taskId),
      this.taskRepo.findDependents(taskId),
      this.documentRepo.findByTaskId(taskId),
    ]);

    const taskDetail: TaskDetail = {
      ...task,
      dependencyTasks,
      delayReasons,
      progressLogs,
      linkedQuotations,
    };

    // ── Linked invoice (set when quote has been accepted) ────────────────────
    let linkedInvoiceRaw = null;
    if (task.quoteInvoiceId) {
      try {
        linkedInvoiceRaw = await this.invoiceRepo.getInvoice(task.quoteInvoiceId);
      } catch {
        linkedInvoiceRaw = null;
      }
    }

    // ── Quotation record check (no invoice yet, but amount is set) ───────────
    let hasQuotationRecord = false;
    if (!task.quoteInvoiceId && task.projectId && task.quoteAmount != null) {
      try {
        const res = await this.quotationRepo.listQuotations({
          projectId: task.projectId,
          limit: 50,
        });
        hasQuotationRecord = res.items.some(
          (q) => typeof q.total === 'number' && q.total === task.quoteAmount,
        );
      } catch {
        hasQuotationRecord = false;
      }
    }

    // ── Subcontractor info ───────────────────────────────────────────────────
    let subcontractorInfo: SubcontractorInfo | null = null;
    if (task.subcontractorId) {
      try {
        const contact = await this.contactRepo.findById(task.subcontractorId);
        if (contact) {
          subcontractorInfo = {
            id: contact.id,
            name: contact.name,
            trade: contact.trade,
            phone: contact.phone,
            email: contact.email,
          };
        }
      } catch {
        subcontractorInfo = null;
      }
    }

    return {
      task: mapTaskToViewDTO(task),
      taskDetail: mapTaskDetailToViewDTO(taskDetail),
      nextInLine: dependents.slice(0, 3).map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
      })),
      documents: documents.map(mapDocumentToViewDTO),
      linkedInvoice: linkedInvoiceRaw ? mapInvoiceToViewDTO(linkedInvoiceRaw) : null,
      hasQuotationRecord,
      subcontractorInfo,
    };
  }
}
