import { useState, useCallback, useMemo } from 'react';
import { container } from 'tsyringe';
import '../infrastructure/di/registerServices';

import { Task } from '../domain/entities/Task';
import { Document } from '../domain/entities/Document';
import { TaskRepository } from '../domain/repositories/TaskRepository';
import { DocumentRepository } from '../domain/repositories/DocumentRepository';
import { IFileSystemAdapter } from '../infrastructure/files/IFileSystemAdapter';

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
  if (existing === 'accepted' || existing === 'rejected') return existing;
  return quoteAmount !== undefined && quoteAmount !== null ? 'issued' : 'pending';
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
        const computedQuoteStatus = computeQuoteStatus(
          taskType,
          quoteAmount,
          (initialTask as Task | undefined)?.quoteStatus,
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
          quoteAmount,
          quoteStatus: computedQuoteStatus,
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
        setPendingDocuments([]);

        // Attach dependencies
        for (const depId of dependencyTaskIds) {
          await addDependencyUseCase.execute({ taskId: newTask.id, dependsOnTaskId: depId });
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
    onSuccess,
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
