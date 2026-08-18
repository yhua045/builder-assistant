import { useState, useCallback, useMemo, useEffect, useRef, useReducer } from 'react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { container } from 'tsyringe';
import '../../../shared/infrastructure/di/registerServices';

import { Task } from '../../../shared/domain/entities/Task';
import { Document } from '../../../shared/domain/entities/Document';
import { RemoveTaskDocumentUseCase } from '../application/RemoveTaskDocumentUseCase';
import {
  ProcessTaskFormUseCase,
  ProcessTaskFormValidationError,
} from '../application/ProcessTaskFormUseCase';
import { invalidations } from '../../../shared/infrastructure/query/queryKeys';
import { useCreateAuditLog } from './useCreateAuditLog';
import type { AnalyticsAdapter } from '../../../shared/infrastructure/analytics/AnalyticsAdapter';

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

export interface TaskFormState {
  title: string;
  notes: string;
  projectId: string;
  dueDate: Date | null;
  startDate: Date | null;
  status: Task['status'];
  priority: Task['priority'];
  subcontractorId: string | undefined;
  taskType: NonNullable<Task['taskType']>;
  workType: string | undefined;
  quoteAmount: number | undefined;
  pendingDocuments: PendingDocument[];
  savedDocuments: Document[];
  dependencyTaskIds: string[];
}

export type TaskFormAction =
  | { type: 'SET_FIELD'; field: keyof TaskFormState; value: any }
  | { type: 'ADD_PENDING_DOCUMENT'; document: PendingDocument }
  | { type: 'REMOVE_PENDING_DOCUMENT'; uri: string }
  | { type: 'SET_SAVED_DOCUMENTS'; documents: Document[] }
  | { type: 'REMOVE_SAVED_DOCUMENT'; docId: string }
  | { type: 'ADD_DEPENDENCY'; id: string }
  | { type: 'REMOVE_DEPENDENCY'; id: string }
  | { type: 'RESET_PENDING_DOCUMENTS' };

function taskFormReducer(state: TaskFormState, action: TaskFormAction): TaskFormState {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value };
    case 'ADD_PENDING_DOCUMENT':
      return { ...state, pendingDocuments: [...state.pendingDocuments, action.document] };
    case 'REMOVE_PENDING_DOCUMENT':
      return { ...state, pendingDocuments: state.pendingDocuments.filter((d) => d.uri !== action.uri) };
    case 'SET_SAVED_DOCUMENTS':
      return { ...state, savedDocuments: action.documents };
    case 'REMOVE_SAVED_DOCUMENT':
      return { ...state, savedDocuments: state.savedDocuments.filter((d) => d.id !== action.docId) };
    case 'ADD_DEPENDENCY':
      if (state.dependencyTaskIds.includes(action.id)) return state;
      return { ...state, dependencyTaskIds: [...state.dependencyTaskIds, action.id] };
    case 'REMOVE_DEPENDENCY':
      return { ...state, dependencyTaskIds: state.dependencyTaskIds.filter((id) => id !== action.id) };
    case 'RESET_PENDING_DOCUMENTS':
      return { ...state, pendingDocuments: [] };
    default:
      return state;
  }
}

export interface UseTaskFormReturn extends TaskFormState {
  // ── Setters ──────────────────────────────────────────────────────────────
  setTitle(v: string): void;
  setNotes(v: string): void;
  setProjectId(v: string): void;
  setStartDate(v: Date | null): void;
  setDueDate(v: Date | null): void;
  setStatus(v: Task['status']): void;
  setPriority(v: Task['priority']): void;
  setSubcontractorId(id: string | undefined): void;
  setTaskType(v: NonNullable<Task['taskType']>): void;
  setWorkType(v: string | undefined): void;
  setQuoteAmount(v: number | undefined): void;

  // ── Documents ─────────────────────────────────────────────────────────────
  addPendingDocument(doc: PendingDocument): void;
  removePendingDocument(uri: string): void;
  removeSavedDocument(docId: string): Promise<void>;

  // ── Dependencies ──────────────────────────────────────────────────────────
  addDependencyTaskId(id: string): void;
  removeDependencyTaskId(id: string): void;

  // ── Submit ────────────────────────────────────────────────────────────────
  isSubmitting: boolean;
  validationError: string | null;
  submit(): Promise<Task | null>;
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

  const [state, dispatch] = useReducer(taskFormReducer, {
    title: initialTask?.title ?? '',
    notes: initialTask?.notes ?? '',
    projectId: initialTask?.projectId ?? defaultProjectId ?? '',
    dueDate: initialTask?.dueDate ? new Date(initialTask.dueDate as string) : null,
    startDate: initialTask?.startDate ? new Date(initialTask.startDate as string) : null,
    status: initialTask?.status ?? 'pending',
    priority: initialTask?.priority ?? 'medium',
    subcontractorId: initialTask?.subcontractorId,
    taskType: initialTask?.taskType ?? 'variation',
    workType: initialTask?.workType,
    quoteAmount: initialTask?.quoteAmount,
    pendingDocuments: [],
    savedDocuments: [],
    dependencyTaskIds: initialTask?.dependencies ?? [],
  });

  const setTitle = useCallback((v: string) => dispatch({ type: 'SET_FIELD', field: 'title', value: v }), []);
  const setNotes = useCallback((v: string) => dispatch({ type: 'SET_FIELD', field: 'notes', value: v }), []);
  const setProjectId = useCallback((v: string) => dispatch({ type: 'SET_FIELD', field: 'projectId', value: v }), []);
  const setDueDate = useCallback((v: Date | null) => dispatch({ type: 'SET_FIELD', field: 'dueDate', value: v }), []);
  const setStartDate = useCallback((v: Date | null) => dispatch({ type: 'SET_FIELD', field: 'startDate', value: v }), []);
  const setStatus = useCallback((v: Task['status']) => dispatch({ type: 'SET_FIELD', field: 'status', value: v }), []);
  const setPriority = useCallback((v: Task['priority']) => dispatch({ type: 'SET_FIELD', field: 'priority', value: v }), []);
  const setSubcontractorId = useCallback((v: string | undefined) => dispatch({ type: 'SET_FIELD', field: 'subcontractorId', value: v }), []);
  const setTaskType = useCallback((v: NonNullable<Task['taskType']>) => dispatch({ type: 'SET_FIELD', field: 'taskType', value: v }), []);
  const setWorkType = useCallback((v: string | undefined) => dispatch({ type: 'SET_FIELD', field: 'workType', value: v }), []);
  const setQuoteAmount = useCallback((v: number | undefined) => dispatch({ type: 'SET_FIELD', field: 'quoteAmount', value: v }), []);
  const addPendingDocument = useCallback((doc: PendingDocument) => dispatch({ type: 'ADD_PENDING_DOCUMENT', document: doc }), []);
  const removePendingDocument = useCallback((uri: string) => dispatch({ type: 'REMOVE_PENDING_DOCUMENT', uri }), []);
  const addDependencyTaskId = useCallback((id: string) => dispatch({ type: 'ADD_DEPENDENCY', id }), []);
  const removeDependencyTaskId = useCallback((id: string) => dispatch({ type: 'REMOVE_DEPENDENCY', id }), []);

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
  const analyticsAdapter = useMemo<AnalyticsAdapter | null>(() => {
    try {
      return container.resolve<AnalyticsAdapter>('AnalyticsAdapter');
    } catch {
      return null;
    }
  }, []);

  // ── Funnel tracking (create mode only) ───────────────────────────────────
  const isCreate = !initialTask?.id;
  const funnelCompletedRef = useRef(false);
  useEffect(() => {
    if (!isCreate) return;
    analyticsAdapter?.track('task_creation_started');
    return () => {
      if (!funnelCompletedRef.current) {
        analyticsAdapter?.track('task_creation_abandoned');
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Remove saved document (eager, edit mode) ──────────────────────────────
  const removeSavedDocument = useCallback(
    async (docId: string) => {
      await removeTaskDocumentUseCase.execute(docId);
      dispatch({ type: 'REMOVE_SAVED_DOCUMENT', docId });
    },
    [removeTaskDocumentUseCase],
  );

  const taskMutation = useMutation({
    mutationFn: (variables: Parameters<ProcessTaskFormUseCase['execute']>[0]) =>
      processTaskFormUseCase.execute(variables),
    onSuccess: async (result) => {
      // ── Query invalidation ───────────────────────────────────────────────
      if (result.variationInvoiceCreated) {
        await Promise.all(
          invalidations.acceptQuotation({ projectId: result.task.projectId || '', taskId: result.task.id })
            .map((key: any) => queryClient.invalidateQueries({ queryKey: key })),
        );
      } else if (result.variationInvoiceCancelled) {
        await Promise.all([
          ...invalidations.invoiceMutated({ projectId: result.task.projectId || undefined }),
          ...invalidations.taskEdited({ projectId: result.task.projectId || '', taskId: result.task.id }),
        ].map(key => queryClient.invalidateQueries({ queryKey: key })));
      } else if (isEditMode) {
        await Promise.all(
          invalidations.taskEdited({ projectId: result.task.projectId || '', taskId: result.task.id })
            .map((key: any) => queryClient.invalidateQueries({ queryKey: key })),
        );
      } else {
        await Promise.all(
          invalidations.tasksCreated({ projectId: result.task.projectId ?? '' })
            .map((key: any) => queryClient.invalidateQueries({ queryKey: key })),
        );
      }

      if (result.documentsAdded > 0) {
        await Promise.all(
          invalidations.documentMutated({ taskId: result.task.id })
            .map((key: any) => queryClient.invalidateQueries({ queryKey: key })),
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

      // ── Feature event & funnel tracking ─────────────────────────────────
      if (!isEditMode) {
        funnelCompletedRef.current = true;
        analyticsAdapter?.track('task_created', {
          projectId: result.task.projectId,
        });
        analyticsAdapter?.track('task_creation_completed', {
          projectId: result.task.projectId,
        });
      }

      dispatch({ type: 'RESET_PENDING_DOCUMENTS' });
      onSuccess?.(result.task);
    },
  });

  // ── Submit ────────────────────────────────────────────────────────────────
  const submit = useCallback(async () => {
    setValidationError(null);

    // Validation
    if (!state.title.trim()) {
      setValidationError('Title is required');
      return null;
    }

    const selfId = initialTask?.id;
    if (selfId && state.dependencyTaskIds.includes(selfId)) {
      setValidationError('A task cannot depend on itself');
      return null;
    }

    try {
      const result = await taskMutation.mutateAsync({
        mode: isEditMode ? 'update' : 'create',
        taskId: selfId,
        existingTask: isEditMode ? (initialTask as Task) : undefined,
        existingDependencies: initialTask?.dependencies ?? [],
        title: state.title.trim(),
        notes: state.notes.trim() || undefined,
        projectId: state.projectId || undefined,
        dueDate: state.dueDate?.toISOString(),
        startDate: state.startDate?.toISOString(),
        status: state.status,
        priority: state.priority,
        subcontractorId: state.subcontractorId,
        taskType: state.taskType,
        workType: state.workType,
        quoteAmount: state.quoteAmount,
        pendingDocuments: state.pendingDocuments,
        dependencyTaskIds: state.dependencyTaskIds,
      });

      return result.task;
    } catch (err) {
      if (err instanceof ProcessTaskFormValidationError) {
        setValidationError(err.message);
        return null;
      }
      throw err;
    }
  }, [
    state,
    initialTask,
    isEditMode,
    taskMutation,
  ]);

  return {
    ...state,
    setTitle,
    setNotes,
    setProjectId,
    setStartDate,
    setDueDate,
    setStatus,
    setPriority,
    setSubcontractorId,
    setTaskType,
    setWorkType,
    setQuoteAmount,
    addPendingDocument,
    removePendingDocument,
    removeSavedDocument,
    addDependencyTaskId,
    removeDependencyTaskId,
    isSubmitting: taskMutation.isPending,
    validationError,
    submit,
    isEditMode,
  };
}
