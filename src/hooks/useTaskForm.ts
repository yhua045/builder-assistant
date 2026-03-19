import { useState, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { container } from 'tsyringe';
import '../infrastructure/di/registerServices';

import { Task } from '../domain/entities/Task';
import { Document } from '../domain/entities/Document';
import { TaskRepository } from '../domain/repositories/TaskRepository';
import { DocumentRepository } from '../domain/repositories/DocumentRepository';
import { InvoiceRepository } from '../domain/repositories/InvoiceRepository';
import { PaymentRepository } from '../domain/repositories/PaymentRepository';
import { ContactRepository } from '../domain/repositories/ContactRepository';
import { QuotationRepository } from '../domain/repositories/QuotationRepository';
import { IFileSystemAdapter } from '../infrastructure/files/IFileSystemAdapter';
import { AcceptQuotationUseCase } from '../application/usecases/quotation/AcceptQuotationUseCase';
import { invalidations, queryKeys } from './queryKeys';
import { useCreateAuditLog } from './useCreateAuditLog';

import { CreateTaskUseCase } from '../application/usecases/task/CreateTaskUseCase';

/**
 * Auto-compute quoteStatus on save based on what data is present.
 * Preserves 'accepted' and 'rejected' finaled states.
 */
function computeQuoteStatus(
  taskType: NonNullable<Task['taskType']>,
  quoteAmount: number | undefined,
  existing: Task['quoteStatus'],
): Task['quoteStatus'] {
  if (taskType === 'standard') return undefined;
  const hasValidAmount = quoteAmount != null && quoteAmount > 0;
  if (!hasValidAmount) return 'pending';
  // Variation tasks auto-accept when a positive amount is entered
  if (taskType === 'variation') return 'accepted';
  // Other types (e.g. contract_work): preserve finalised state
  if (existing === 'accepted' || existing === 'rejected') return existing;
  return 'issued';
}
import { UpdateTaskUseCase } from '../application/usecases/task/UpdateTaskUseCase';
import { AddTaskDependencyUseCase } from '../application/usecases/task/AddTaskDependencyUseCase';
import { RemoveTaskDependencyUseCase } from '../application/usecases/task/RemoveTaskDependencyUseCase';
import { AddTaskDocumentUseCase } from '../application/usecases/document/AddTaskDocumentUseCase';
import { RemoveTaskDocumentUseCase } from '../application/usecases/document/RemoveTaskDocumentUseCase';

/** A document that has been picked but not yet persisted (pre-save state). */
export interface PendingDocument {
  /** Local file URI from the picker */
  uri: string;
  filename: string;
  mimeType?: string;
  size?: number;
}

export interface UseTaskFormOptions {
  /** Pre-populate the form. When `initialTask.id` is defined, the hook enters **update** mode. */
  initialTask?: Partial<Task>;
  /** Default project to assign to new tasks */
  projectId?: string;
  /** Called after a successful save with the resulting Task */
  onSuccess?: (task: Task) => void;
}

export interface UseTaskFormReturn {
  // ── Basic fields ──────────────────────────────────────────────────────────
  title: string;
  setTitle(v: string): void;
  notes: string;
  setNotes(v: string): void;
  projectId: string;
  setProjectId(v: string): void;
  dueDate: Date | null;
  setDueDate(v: Date | null): void;
  status: Task['status'];
  setStatus(v: Task['status']): void;
  priority: Task['priority'];
  setPriority(v: Task['priority']): void;

  // ── Subcontractor ─────────────────────────────────────────────────────────
  subcontractorId: string | undefined;
  setSubcontractorId(id: string | undefined): void;

  // ── Task Classification (issue #141) ──────────────────────────────────────
  taskType: NonNullable<Task['taskType']>;
  setTaskType(v: NonNullable<Task['taskType']>): void;
  workType: string | undefined;
  setWorkType(v: string | undefined): void;
  quoteAmount: number | undefined;
  setQuoteAmount(v: number | undefined): void;

  // ── Documents ─────────────────────────────────────────────────────────────
  /** Documents picked this session — not yet written to DB */
  pendingDocuments: PendingDocument[];
  addPendingDocument(doc: PendingDocument): void;
  removePendingDocument(uri: string): void;
  /** Documents already persisted (edit mode only) */
  savedDocuments: Document[];
  removeSavedDocument(docId: string): Promise<void>;

  // ── Dependencies ──────────────────────────────────────────────────────────
  dependencyTaskIds: string[];
  addDependencyTaskId(id: string): void;
  removeDependencyTaskId(id: string): void;

  // ── Submit ────────────────────────────────────────────────────────────────
  isSubmitting: boolean;
  validationError: string | null;
  submit(): Promise<void>;

  /** Whether the form is in edit mode (editing an existing task) */
  isEditMode: boolean;
}

export function useTaskForm({
  initialTask,
  projectId: defaultProjectId,
  onSuccess,
}: UseTaskFormOptions = {}): UseTaskFormReturn {
  const isEditMode = Boolean(initialTask?.id);
  const queryClient = useQueryClient();
  const { createEntry: createAuditEntry } = useCreateAuditLog();

  // ── Basic fields ──────────────────────────────────────────────────────────
  const [title, setTitle] = useState(initialTask?.title ?? '');
  const [notes, setNotes] = useState(initialTask?.notes ?? '');
  const [projectId, setProjectId] = useState(
    initialTask?.projectId ?? defaultProjectId ?? '',
  );
  const [dueDate, setDueDate] = useState<Date | null>(
    initialTask?.dueDate ? new Date(initialTask.dueDate as string) : null,
  );
  const [status, setStatus] = useState<Task['status']>(
    initialTask?.status ?? 'pending',
  );
  const [priority, setPriority] = useState<Task['priority']>(
    initialTask?.priority ?? 'medium',
  );

  // ── Subcontractor ─────────────────────────────────────────────────────────
  const [subcontractorId, setSubcontractorId] = useState<string | undefined>(
    initialTask?.subcontractorId,
  );

  // ── Task Classification (issue #141) ──────────────────────────────────────
  const [taskType, setTaskType] = useState<NonNullable<Task['taskType']>>(
    initialTask?.taskType ?? 'variation',
  );
  const [workType, setWorkType] = useState<string | undefined>(
    initialTask?.workType,
  );
  const [quoteAmount, setQuoteAmount] = useState<number | undefined>(
    initialTask?.quoteAmount,
  );

  // ── Documents ─────────────────────────────────────────────────────────────
  const [pendingDocuments, setPendingDocuments] = useState<PendingDocument[]>([]);
  const [savedDocuments, setSavedDocuments] = useState<Document[]>(
    // Populated externally (e.g. from TaskDetail query) for edit mode.
    // Callers may pass pre-fetched docs via initialTask's extended fields if desired.
    [],
  );

  const addPendingDocument = useCallback((doc: PendingDocument) => {
    setPendingDocuments((prev) => [...prev, doc]);
  }, []);

  const removePendingDocument = useCallback((uri: string) => {
    setPendingDocuments((prev) => prev.filter((d) => d.uri !== uri));
  }, []);

  // ── Dependencies ──────────────────────────────────────────────────────────
  const [dependencyTaskIds, setDependencyTaskIds] = useState<string[]>(
    initialTask?.dependencies ?? [],
  );

  const addDependencyTaskId = useCallback((id: string) => {
    setDependencyTaskIds((prev) => {
      if (prev.includes(id)) return prev;
      return [...prev, id];
    });
  }, []);

  const removeDependencyTaskId = useCallback((id: string) => {
    setDependencyTaskIds((prev) => prev.filter((d) => d !== id));
  }, []);

  // ── Submit state ──────────────────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // ── DI resolution ─────────────────────────────────────────────────────────
  const taskRepository = useMemo(
    () => container.resolve<TaskRepository>('TaskRepository'),
    [],
  );
  const documentRepository = useMemo(
    () => container.resolve<DocumentRepository>('DocumentRepository'),
    [],
  );
  const fileSystem = useMemo(
    () => container.resolve<IFileSystemAdapter>('FileSystemAdapter'),
    [],
  );

  const createTaskUseCase = useMemo(
    () => new CreateTaskUseCase(taskRepository),
    [taskRepository],
  );
  const updateTaskUseCase = useMemo(
    () => new UpdateTaskUseCase(taskRepository),
    [taskRepository],
  );
  const addTaskDocumentUseCase = useMemo(
    () => new AddTaskDocumentUseCase(documentRepository, fileSystem),
    [documentRepository, fileSystem],
  );
  const removeTaskDocumentUseCase = useMemo(
    () => new RemoveTaskDocumentUseCase(documentRepository, fileSystem),
    [documentRepository, fileSystem],
  );
  const addDependencyUseCase = useMemo(
    () => new AddTaskDependencyUseCase(taskRepository),
    [taskRepository],
  );
  const removeDependencyUseCase = useMemo(
    () => new RemoveTaskDependencyUseCase(taskRepository),
    [taskRepository],
  );

  const invoiceRepository = useMemo(() => {
    try { return container.resolve<InvoiceRepository>('InvoiceRepository'); }
    catch { return null; }
  }, []);

  const paymentRepository = useMemo(() => {
    try { return container.resolve<PaymentRepository>('PaymentRepository'); }
    catch { return null; }
  }, []);

  const contactRepository = useMemo(() => {
    try { return container.resolve<ContactRepository>('ContactRepository'); }
    catch { return null; }
  }, []);

  const quotationRepository = useMemo(() => {
    try { return container.resolve<QuotationRepository>('QuotationRepository'); }
    catch { return null; }
  }, []);

  const acceptQuotationUseCase = useMemo(() => {
    if (!invoiceRepository) return null;
    return new AcceptQuotationUseCase(
      invoiceRepository,
      taskRepository,
      quotationRepository ?? undefined,
    );
  }, [invoiceRepository, taskRepository, quotationRepository]);

  // ── Remove saved document (eager, edit mode) ──────────────────────────────
  const removeSavedDocument = useCallback(
    async (docId: string) => {
      await removeTaskDocumentUseCase.execute(docId);
      setSavedDocuments((prev) => prev.filter((d) => d.id !== docId));
    },
    [removeTaskDocumentUseCase],
  );

  // ── Submit ────────────────────────────────────────────────────────────────
  const submit = useCallback(async () => {
    setValidationError(null);

    // Validation
    if (!title.trim()) {
      setValidationError('Title is required');
      return;
    }

    const selfId = initialTask?.id;
    if (selfId && dependencyTaskIds.includes(selfId)) {
      setValidationError('A task cannot depend on itself');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditMode && selfId) {
        // ── Update mode ───────────────────────────────────────────────────
        const existingTask = initialTask as Task | undefined;
        const existingInvoiceId = existingTask?.quoteInvoiceId;
        const isVariation = taskType === 'variation';
        const hasValidAmount = quoteAmount != null && quoteAmount > 0;

        // Guard: block clearing a variation amount when the linked invoice has payments
        if (isVariation && !hasValidAmount && existingInvoiceId && paymentRepository) {
          const payments = await paymentRepository.findByInvoice(existingInvoiceId);
          if (payments.length > 0) {
            setValidationError(
              'Cannot remove the quote amount — this variation invoice already has recorded payments.',
            );
            return;
          }
        }

        const computedQuoteStatus = computeQuoteStatus(
          taskType,
          quoteAmount,
          existingTask?.quoteStatus,
        );
        const updatedTask: Task = {
          ...(initialTask as Task),
          title: title.trim(),
          notes: notes.trim() || undefined,
          projectId: projectId || undefined,
          dueDate: dueDate?.toISOString(),
          status,
          priority,
          subcontractorId,
          isScheduled: !!dueDate,
          taskType,
          workType,
          quoteAmount: hasValidAmount ? quoteAmount : undefined,
          quoteStatus: computedQuoteStatus,
          // Clear invoice link when amount is removed
          quoteInvoiceId: isVariation && !hasValidAmount ? undefined : existingInvoiceId,
          updatedAt: new Date().toISOString(),
        };
        await updateTaskUseCase.execute(updatedTask);

        // Attach any newly-picked documents
        for (const pd of pendingDocuments) {
          await addTaskDocumentUseCase.execute({
            taskId: selfId,
            projectId: projectId || undefined,
            sourceUri: pd.uri,
            filename: pd.filename,
            mimeType: pd.mimeType,
            size: pd.size,
          });
        }
        if (pendingDocuments.length > 0) {
          await Promise.all(
            invalidations.documentMutated({ taskId: selfId })
              .map(key => queryClient.invalidateQueries({ queryKey: key }))
          );
        }
        setPendingDocuments([]);

        // Sync dependency additions (removals were applied eagerly)
        const existingDeps = initialTask?.dependencies ?? [];
        for (const depId of dependencyTaskIds) {
          if (!existingDeps.includes(depId)) {
            await addDependencyUseCase.execute({ taskId: selfId, dependsOnTaskId: depId });
          }
        }
        for (const depId of existingDeps) {
          if (!dependencyTaskIds.includes(depId)) {
            await removeDependencyUseCase.execute({ taskId: selfId, dependsOnTaskId: depId });
          }
        }

        // ── Variation: auto-create invoice via AcceptQuotationUseCase ──────────
        if (isVariation && hasValidAmount && !existingInvoiceId && acceptQuotationUseCase) {
          const contact = subcontractorId && contactRepository
            ? await contactRepository.findById(subcontractorId)
            : null;
          const result = await acceptQuotationUseCase.execute({
            taskId: selfId,
            task: {
              title: title.trim(),
              projectId: projectId || undefined,
              quoteAmount: quoteAmount!,
              taskType,
              workType,
              subcontractorId,
            },
            contact,
          });
          await Promise.all(
            invalidations.acceptQuotation({ projectId: projectId || '', taskId: selfId })
              .map(key => queryClient.invalidateQueries({ queryKey: key }))
          );
          const taskWithInvoice: Task = { ...updatedTask, quoteInvoiceId: result.invoice.id, quoteStatus: 'accepted' };
          onSuccess?.(taskWithInvoice);
          return;
        }

        // ── Variation: cancel linked invoice when amount is removed (no payments) ──
        if (isVariation && !hasValidAmount && existingInvoiceId && invoiceRepository) {
          await invoiceRepository.updateInvoice(existingInvoiceId, {
            status: 'cancelled',
            updatedAt: new Date().toISOString(),
          });
          await Promise.all(
            invalidations.invoiceMutated({ projectId: projectId || undefined })
              .map(key => queryClient.invalidateQueries({ queryKey: key }))
          );
        }

        await Promise.all(
          invalidations.taskEdited({ projectId: projectId || '', taskId: selfId })
            .map(key => queryClient.invalidateQueries({ queryKey: key }))
        );
        if (projectId) {
          await createAuditEntry({
            projectId,
            taskId: selfId,
            source: 'Task Form',
            action: `Updated task "${updatedTask.title}"`,
          });
        }
        onSuccess?.(updatedTask);
      } else {
        // ── Create mode ───────────────────────────────────────────────────
        const computedQuoteStatus = computeQuoteStatus(taskType, quoteAmount, undefined);
        const newTask = await createTaskUseCase.execute({
          title: title.trim(),
          notes: notes.trim() || undefined,
          projectId: projectId || undefined,
          dueDate: dueDate?.toISOString(),
          status,
          priority,
          subcontractorId,
          isScheduled: !!dueDate,
          taskType,
          workType,
          quoteAmount,
          quoteStatus: computedQuoteStatus,
        });

        // Attach documents now that we have a taskId
        for (const pd of pendingDocuments) {
          await addTaskDocumentUseCase.execute({
            taskId: newTask.id,
            projectId: newTask.projectId,
            sourceUri: pd.uri,
            filename: pd.filename,
            mimeType: pd.mimeType,
            size: pd.size,
          });
        }
        if (pendingDocuments.length > 0) {
          await Promise.all(
            invalidations.documentMutated({ taskId: newTask.id })
              .map(key => queryClient.invalidateQueries({ queryKey: key }))
          );
        }
        setPendingDocuments([]);

        // Attach dependencies
        for (const depId of dependencyTaskIds) {
          await addDependencyUseCase.execute({ taskId: newTask.id, dependsOnTaskId: depId });
        }

        // ── Variation: auto-create invoice via AcceptQuotationUseCase ──────────
        if (taskType === 'variation' && quoteAmount != null && quoteAmount > 0 && acceptQuotationUseCase) {
          const contact = subcontractorId && contactRepository
            ? await contactRepository.findById(subcontractorId)
            : null;
          const result = await acceptQuotationUseCase.execute({
            taskId: newTask.id,
            task: {
              title: newTask.title,
              projectId: newTask.projectId,
              quoteAmount,
              taskType,
              workType,
              subcontractorId,
            },
            contact,
          });
          await Promise.all(
            invalidations.acceptQuotation({ projectId: newTask.projectId || '', taskId: newTask.id })
              .map(key => queryClient.invalidateQueries({ queryKey: key }))
          );
          const taskWithInvoice: Task = { ...newTask, quoteInvoiceId: result.invoice.id, quoteStatus: 'accepted' };
          onSuccess?.(taskWithInvoice);
          return;
        }

        await queryClient.invalidateQueries({ queryKey: queryKeys.tasks(newTask.projectId) });
        if (newTask.projectId) {
          await createAuditEntry({
            projectId: newTask.projectId,
            taskId: newTask.id,
            source: 'Task Form',
            action: `Created task "${newTask.title}"`,
          });
        }
        onSuccess?.(newTask);
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [
    title,
    notes,
    projectId,
    dueDate,
    status,
    priority,
    subcontractorId,
    taskType,
    workType,
    quoteAmount,
    pendingDocuments,
    dependencyTaskIds,
    initialTask,
    isEditMode,
    createTaskUseCase,
    updateTaskUseCase,
    addTaskDocumentUseCase,
    addDependencyUseCase,
    removeDependencyUseCase,
    invoiceRepository,
    paymentRepository,
    acceptQuotationUseCase,
    contactRepository,
    onSuccess,
    queryClient,
    createAuditEntry,
  ]);

  return {
    title,
    setTitle,
    notes,
    setNotes,
    projectId,
    setProjectId,
    dueDate,
    setDueDate,
    status,
    setStatus,
    priority,
    setPriority,
    subcontractorId,
    setSubcontractorId,
    taskType,
    setTaskType,
    workType,
    setWorkType,
    quoteAmount,
    setQuoteAmount,
    pendingDocuments,
    addPendingDocument,
    removePendingDocument,
    savedDocuments,
    removeSavedDocument,
    dependencyTaskIds,
    addDependencyTaskId,
    removeDependencyTaskId,
    isSubmitting,
    validationError,
    submit,
    isEditMode,
  };
}
