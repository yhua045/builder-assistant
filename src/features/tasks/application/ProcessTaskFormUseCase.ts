import { Task } from '../../../domain/entities/Task';
import { ContactRepository } from '../../../domain/repositories/ContactRepository';
import { InvoiceRepository } from '../../../domain/repositories/InvoiceRepository';
import { PaymentRepository } from '../../../domain/repositories/PaymentRepository';
import { QuotationRepository } from '../../../domain/repositories/QuotationRepository';
import { TaskRepository } from '../../../domain/repositories/TaskRepository';
import { AddTaskDocumentUseCase } from './AddTaskDocumentUseCase';
import { AcceptQuotationUseCase } from '../../quotations/application/AcceptQuotationUseCase';
import { AddTaskDependencyUseCase } from './AddTaskDependencyUseCase';
import { CreateTaskUseCase } from './CreateTaskUseCase';
import { RemoveTaskDependencyUseCase } from './RemoveTaskDependencyUseCase';
import { UpdateTaskUseCase } from './UpdateTaskUseCase';

/** A document picked in the UI but not yet persisted. */
export interface TaskFormDocumentInput {
  uri: string;
  filename: string;
  mimeType?: string;
  size?: number;
}

export interface ProcessTaskFormInput {
  /** 'create' for new tasks, 'update' for existing ones. */
  mode: 'create' | 'update';
  /** Required in update mode — the ID of the task being edited. */
  taskId?: string;
  /** Required in update mode — the current persisted state of the task. */
  existingTask?: Task;
  /** Dependencies already stored on the task (update mode). */
  existingDependencies: string[];

  // ── Task fields ───────────────────────────────────────────────────────────
  title: string;
  notes?: string;
  projectId?: string;
  dueDate?: string;
  startDate?: string;
  status: Task['status'];
  priority: Task['priority'];
  subcontractorId?: string;
  taskType: NonNullable<Task['taskType']>;
  workType?: string;
  quoteAmount?: number;

  // ── Related data ──────────────────────────────────────────────────────────
  pendingDocuments: TaskFormDocumentInput[];
  dependencyTaskIds: string[];
}

export interface ProcessTaskFormOutput {
  task: Task;
  /** True when AcceptQuotationUseCase created a new variation invoice. */
  variationInvoiceCreated: boolean;
  /** True when an existing variation invoice was cancelled (amount removed, no payments). */
  variationInvoiceCancelled: boolean;
  /** Number of document records persisted during this submission. */
  documentsAdded: number;
}

/**
 * Raised when the form submission is blocked by a business rule (e.g. clearing
 * a variation amount that already has recorded payments).  The hook layer
 * catches this and surfaces it as a `validationError` rather than a crash.
 */
export class ProcessTaskFormValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProcessTaskFormValidationError';
  }
}

/**
 * ProcessTaskFormUseCase
 *
 * Encapsulates all business logic triggered by the Task Form submission:
 *  - Creating or updating the Task entity
 *  - Attaching pending documents
 *  - Syncing task dependencies (add / remove diff)
 *  - Auto-creating a variation invoice via AcceptQuotationUseCase
 *  - Cancelling a variation invoice when the quote amount is removed
 *  - Payment guard: blocks clearing an amount when payments already exist
 */
export class ProcessTaskFormUseCase {
  private readonly createTask: CreateTaskUseCase;
  private readonly updateTask: UpdateTaskUseCase;
  private readonly addDependency: AddTaskDependencyUseCase;
  private readonly removeDependency: RemoveTaskDependencyUseCase;
  private readonly acceptQuotation: AcceptQuotationUseCase;

  constructor(
    private readonly taskRepo: TaskRepository,
    private readonly invoiceRepo: InvoiceRepository,
    private readonly paymentRepo: PaymentRepository,
    private readonly contactRepo: ContactRepository,
    private readonly quotationRepo: QuotationRepository | undefined,
    private readonly addDocumentUseCase: AddTaskDocumentUseCase,
  ) {
    this.createTask = new CreateTaskUseCase(taskRepo);
    this.updateTask = new UpdateTaskUseCase(taskRepo);
    this.addDependency = new AddTaskDependencyUseCase(taskRepo);
    this.removeDependency = new RemoveTaskDependencyUseCase(taskRepo);
    this.acceptQuotation = new AcceptQuotationUseCase(invoiceRepo, taskRepo, quotationRepo);
  }

  async execute(input: ProcessTaskFormInput): Promise<ProcessTaskFormOutput> {
    return input.mode === 'update'
      ? this.executeUpdate(input)
      : this.executeCreate(input);
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private computeQuoteStatus(
    taskType: NonNullable<Task['taskType']>,
    quoteAmount: number | undefined,
    existing: Task['quoteStatus'],
  ): Task['quoteStatus'] {
    if (taskType === 'standard') return undefined;
    const hasValidAmount = quoteAmount != null && quoteAmount > 0;
    if (!hasValidAmount) return 'pending';
    if (taskType === 'variation') return 'accepted';
    if (existing === 'accepted' || existing === 'rejected') return existing;
    return 'issued';
  }

  private async executeCreate(input: ProcessTaskFormInput): Promise<ProcessTaskFormOutput> {
    const { taskType, quoteAmount, subcontractorId, workType, dependencyTaskIds, pendingDocuments } = input;
    const hasValidAmount = quoteAmount != null && quoteAmount > 0;
    const computedQuoteStatus = this.computeQuoteStatus(taskType, quoteAmount, undefined);

    // 1. Persist the new task
    const newTask = await this.createTask.execute({
      title: input.title,
      notes: input.notes,
      projectId: input.projectId,
      dueDate: input.dueDate,
      startDate: input.startDate,
      status: input.status,
      priority: input.priority,
      subcontractorId,
      isScheduled: !!input.dueDate,
      taskType,
      workType,
      quoteAmount,
      quoteStatus: computedQuoteStatus,
    });

    // 2. Attach any pending documents
    for (const pd of pendingDocuments) {
      await this.addDocumentUseCase.execute({
        taskId: newTask.id,
        projectId: newTask.projectId,
        sourceUri: pd.uri,
        filename: pd.filename,
        mimeType: pd.mimeType,
        size: pd.size,
      });
    }

    // 3. Attach dependencies
    for (const depId of dependencyTaskIds) {
      await this.addDependency.execute({ taskId: newTask.id, dependsOnTaskId: depId });
    }

    // 4. Variation: auto-create invoice
    if (taskType === 'variation' && hasValidAmount) {
      const contact = subcontractorId
        ? await this.contactRepo.findById(subcontractorId)
        : null;
      const result = await this.acceptQuotation.execute({
        taskId: newTask.id,
        task: {
          title: newTask.title,
          projectId: newTask.projectId,
          quoteAmount: quoteAmount!,
          taskType,
          workType,
          subcontractorId,
        },
        contact,
      });
      return {
        task: { ...newTask, quoteInvoiceId: result.invoice.id, quoteStatus: 'accepted' },
        variationInvoiceCreated: true,
        variationInvoiceCancelled: false,
        documentsAdded: pendingDocuments.length,
      };
    }

    return {
      task: newTask,
      variationInvoiceCreated: false,
      variationInvoiceCancelled: false,
      documentsAdded: pendingDocuments.length,
    };
  }

  private async executeUpdate(input: ProcessTaskFormInput): Promise<ProcessTaskFormOutput> {
    const { taskId, existingTask, existingDependencies, taskType, quoteAmount, subcontractorId, workType, dependencyTaskIds, pendingDocuments } = input;

    if (!taskId) throw new Error('taskId is required for update mode');

    const existingInvoiceId = existingTask?.quoteInvoiceId;
    const isVariation = taskType === 'variation';
    const hasValidAmount = quoteAmount != null && quoteAmount > 0;

    // 1. Guard: block clearing a variation amount when the invoice already has payments
    if (isVariation && !hasValidAmount && existingInvoiceId) {
      const payments = await this.paymentRepo.findByInvoice(existingInvoiceId);
      if (payments.length > 0) {
        throw new ProcessTaskFormValidationError(
          'Cannot remove the quote amount — this variation invoice already has recorded payments.',
        );
      }
    }

    // 2. Persist the updated task
    const computedQuoteStatus = this.computeQuoteStatus(taskType, quoteAmount, existingTask?.quoteStatus);
    const updatedTask = await this.updateTask.execute({
      taskId,
      updates: {
        title: input.title,
        notes: input.notes,
        projectId: input.projectId,
        dueDate: input.dueDate,
        startDate: input.startDate,
        status: input.status,
        priority: input.priority,
        subcontractorId,
        isScheduled: !!input.dueDate,
        taskType,
        workType,
        quoteAmount: hasValidAmount ? quoteAmount : undefined,
        quoteStatus: computedQuoteStatus,
        // Clear invoice link when amount is removed
        quoteInvoiceId: isVariation && !hasValidAmount ? undefined : existingInvoiceId,
        updatedAt: new Date().toISOString(),
      },
    });

    // 3. Attach pending documents
    for (const pd of pendingDocuments) {
      await this.addDocumentUseCase.execute({
        taskId,
        projectId: input.projectId,
        sourceUri: pd.uri,
        filename: pd.filename,
        mimeType: pd.mimeType,
        size: pd.size,
      });
    }

    // 4. Sync dependencies (add new ones; remove dropped ones)
    for (const depId of dependencyTaskIds) {
      if (!existingDependencies.includes(depId)) {
        await this.addDependency.execute({ taskId, dependsOnTaskId: depId });
      }
    }
    for (const depId of existingDependencies) {
      if (!dependencyTaskIds.includes(depId)) {
        await this.removeDependency.execute({ taskId, dependsOnTaskId: depId });
      }
    }

    // 5. Variation: auto-create invoice when amount is added for the first time
    if (isVariation && hasValidAmount && !existingInvoiceId) {
      const contact = subcontractorId
        ? await this.contactRepo.findById(subcontractorId)
        : null;
      const result = await this.acceptQuotation.execute({
        taskId,
        task: {
          title: input.title,
          projectId: input.projectId,
          quoteAmount: quoteAmount!,
          taskType,
          workType,
          subcontractorId,
        },
        contact,
      });
      return {
        task: { ...updatedTask, quoteInvoiceId: result.invoice.id, quoteStatus: 'accepted' },
        variationInvoiceCreated: true,
        variationInvoiceCancelled: false,
        documentsAdded: pendingDocuments.length,
      };
    }

    // 6. Variation: cancel invoice when amount is removed (payment guard passed in step 1)
    if (isVariation && !hasValidAmount && existingInvoiceId) {
      await this.invoiceRepo.updateInvoice(existingInvoiceId, {
        status: 'cancelled',
        updatedAt: new Date().toISOString(),
      });
      return {
        task: updatedTask,
        variationInvoiceCreated: false,
        variationInvoiceCancelled: true,
        documentsAdded: pendingDocuments.length,
      };
    }

    return {
      task: updatedTask,
      variationInvoiceCreated: false,
      variationInvoiceCancelled: false,
      documentsAdded: pendingDocuments.length,
    };
  }
}
