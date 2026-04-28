import { useState, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { container } from 'tsyringe';
import '../../../infrastructure/di/registerServices';

import { Task } from '../../../domain/entities/Task';
import { Document } from '../../../domain/entities/Document';
import { RemoveTaskDocumentUseCase } from '../application/RemoveTaskDocumentUseCase';
import {
  ProcessTaskFormUseCase,
  ProcessTaskFormValidationError,
} from '../application/ProcessTaskFormUseCase';
import { invalidations } from '../../../hooks/queryKeys';
import { useCreateAuditLog } from '../../../hooks/useCreateAuditLog';

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
  startDate: Date | null;
  setStartDate(v: Date | null): void;
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
  /** Returns the saved Task on success, or null on validation failure. Throws on unexpected errors. */
  submit(): Promise<Task | null>;

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
  const [startDate, setStartDate] = useState<Date | null>(
    initialTask?.startDate ? new Date(initialTask.startDate as string) : null,
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
  const processTaskFormUseCase = useMemo(
    () => container.resolve<ProcessTaskFormUseCase>('ProcessTaskFormUseCase'),
    [],
  );
  const removeTaskDocumentUseCase = useMemo(
    () => container.resolve<RemoveTaskDocumentUseCase>('RemoveTaskDocumentUseCase'),
    [],
  );

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
      return null;
    }

    const selfId = initialTask?.id;
    if (selfId && dependencyTaskIds.includes(selfId)) {
      setValidationError('A task cannot depend on itself');
      return null;
    }

    setIsSubmitting(true);
    try {
      const result = await processTaskFormUseCase.execute({
        mode: isEditMode ? 'update' : 'create',
        taskId: selfId,
        existingTask: isEditMode ? (initialTask as Task) : undefined,
        existingDependencies: initialTask?.dependencies ?? [],
        title: title.trim(),
        notes: notes.trim() || undefined,
        projectId: projectId || undefined,
        dueDate: dueDate?.toISOString(),
        startDate: startDate?.toISOString(),
        status,
        priority,
        subcontractorId,
        taskType,
        workType,
        quoteAmount,
        pendingDocuments,
        dependencyTaskIds,
      });

      // ── Query invalidation ───────────────────────────────────────────────
      if (result.variationInvoiceCreated) {
        await Promise.all(
          invalidations.acceptQuotation({ projectId: result.task.projectId || '', taskId: result.task.id })
            .map(key => queryClient.invalidateQueries({ queryKey: key })),
        );
      } else if (result.variationInvoiceCancelled) {
        await Promise.all([
          ...invalidations.invoiceMutated({ projectId: result.task.projectId || undefined }),
          ...invalidations.taskEdited({ projectId: result.task.projectId || '', taskId: result.task.id }),
        ].map(key => queryClient.invalidateQueries({ queryKey: key })));
      } else if (isEditMode) {
        await Promise.all(
          invalidations.taskEdited({ projectId: result.task.projectId || '', taskId: result.task.id })
            .map(key => queryClient.invalidateQueries({ queryKey: key })),
        );
      } else {
        await Promise.all(
          invalidations.tasksCreated({ projectId: result.task.projectId ?? '' })
            .map(key => queryClient.invalidateQueries({ queryKey: key })),
        );
      }

      if (result.documentsAdded > 0) {
        await Promise.all(
          invalidations.documentMutated({ taskId: result.task.id })
            .map(key => queryClient.invalidateQueries({ queryKey: key })),
        );
      }

      // ── Audit log ────────────────────────────────────────────────────────
      if (result.task.projectId) {
        await createAuditEntry({
          projectId: result.task.projectId,
          taskId: result.task.id,
          source: 'Task Form',
          action: isEditMode
            ? `Updated task "${result.task.title}"`
            : `Created task "${result.task.title}"`,
        });
      }

      setPendingDocuments([]);
      onSuccess?.(result.task);
      return result.task;
    } catch (err) {
      if (err instanceof ProcessTaskFormValidationError) {
        setValidationError(err.message);
        return null;
      }
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, [
    title,
    notes,
    projectId,
    startDate,
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
    processTaskFormUseCase,
    queryClient,
    createAuditEntry,
    onSuccess,
  ]);

  return {
    title,
    setTitle,
    notes,
    setNotes,
    projectId,
    setProjectId,
    startDate,
    setStartDate,
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
