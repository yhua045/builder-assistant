/**
 * useTaskDetails — View-Model Facade for TaskDetailsPage.
 *
 * Design: design/issue-210-task-screens-refactor.md §5
 *
 * Encapsulates:
 *  - DI container resolution for all 5 repositories and AddTaskDocumentUseCase
 *  - Full loadData async orchestration
 *  - All 15 useState variables (task, documents, modals, etc.)
 *  - Data-shape mapping (Contact → SubcontractorInfo)
 *  - All action handlers and cache-invalidation logic
 *  - Auto-trigger for openProgressLog / openDocument route params
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { container } from 'tsyringe';
import '../../../infrastructure/di/registerServices';
import { useTasks, TaskDetail } from './useTasks';
import { useDelayReasonTypes } from '../../../hooks/useDelayReasonTypes';
import { useConfirm } from '../../../hooks/useConfirm';
import type {
  TaskViewDTO,
  TaskDetailViewDTO,
  DocumentViewDTO,
  InvoiceViewDTO,
  NextInLineItemDTO,
  ProgressLogViewDTO,
  TaskStatus,
  TaskPriority,
} from '../application/TaskViewDTOs';
import { IFilePickerAdapter } from '../../../infrastructure/files/IFilePickerAdapter';
import { AddTaskDocumentUseCase } from '../application/AddTaskDocumentUseCase';
import { GetTaskDetailsUseCase, SubcontractorInfo } from '../application/GetTaskDetailsUseCase';
import { TaskCompletionValidationError, PendingPaymentsForTaskError } from '../application/TaskCompletionErrors';
import { AddDelayReasonFormData } from '../components/AddDelayReasonModal';
import { AddProgressLogFormData } from '../components/AddProgressLogModal';
import { SubcontractorContact } from '../components/SubcontractorPickerModal';
import { invalidations } from '../../../hooks/queryKeys';

export type { SubcontractorInfo };

// ── Public types ───────────────────────────────────────────────────────────────

export interface TaskDetailsViewModel {
  // Data state
  task: TaskViewDTO | null;
  taskDetail: TaskDetailViewDTO | null;
  nextInLine: NextInLineItemDTO[];
  documents: DocumentViewDTO[];
  subcontractorInfo: SubcontractorInfo | null;
  linkedInvoice: InvoiceViewDTO | null;
  hasQuotationRecord: boolean;
  loading: boolean;
  completing: boolean;
  uploadingDocument: boolean;

  // Modal state
  showDelayModal: boolean;
  showTaskPicker: boolean;
  showSubcontractorPicker: boolean;
  showAddLogModal: boolean;
  editingLog: ProgressLogViewDTO | null;

  // Derived helpers
  isCompleted: boolean;
  delayReasonTypes: ReturnType<typeof useDelayReasonTypes>['delayReasonTypes'];

  // Actions
  handleComplete: () => Promise<void>;
  handleDelete: () => Promise<void>;
  handleStatusChange: (status: TaskStatus) => Promise<void>;
  handlePriorityChange: (priority: TaskPriority) => Promise<void>;
  handleAddDelayReason: (data: AddDelayReasonFormData) => Promise<void>;
  handleAddDependency: (selectedTaskId: string) => Promise<void>;
  handleRemoveDependency: (dependsOnTaskId: string) => Promise<void>;
  handleAddProgressLog: (data: AddProgressLogFormData) => Promise<void>;
  handleUpdateProgressLog: (data: AddProgressLogFormData) => Promise<void>;
  handleDeleteProgressLog: (logId: string) => Promise<void>;
  handleAddDocument: () => Promise<void>;
  handleSubcontractorSelect: (contact: SubcontractorContact | undefined) => Promise<void>;

  // Modal toggles
  openDelayModal: () => void;
  closeDelayModal: () => void;
  openTaskPicker: () => void;
  closeTaskPicker: () => void;
  openSubcontractorPicker: () => void;
  closeSubcontractorPicker: () => void;
  openAddLogModal: () => void;
  closeAddLogModal: () => void;
  setEditingLog: (log: ProgressLogViewDTO | null) => void;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useTaskDetails(
  taskId: string,
  autoOpen?: { progressLog?: boolean; document?: boolean },
): TaskDetailsViewModel {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();

  const {
    deleteTask,
    updateTask,
    addDependency,
    removeDependency,
    addDelayReason,
    addProgressLog,
    updateProgressLog,
    deleteProgressLog,
    completeTask,
    completeTaskAndSettlePayments,
  } = useTasks();
  const { delayReasonTypes } = useDelayReasonTypes();
  const { confirm } = useConfirm();

  // ── DI resolution ──────────────────────────────────────────────────────────

  const getTaskDetailsUseCase = useMemo(() => {
    try { return container.resolve<GetTaskDetailsUseCase>('GetTaskDetailsUseCase'); }
    catch { return null; }
  }, []);

  const filePickerAdapter = useMemo(() => {
    try { return container.resolve<IFilePickerAdapter>('IFilePickerAdapter'); }
    catch { return null; }
  }, []);

  // Resolved once — DI container injects DocumentRepository + FileSystemAdapter
  const addTaskDocumentUseCase = useMemo(() => {
    try { return container.resolve<AddTaskDocumentUseCase>('AddTaskDocumentUseCase'); }
    catch { return null; }
  }, []);

  // ── State ──────────────────────────────────────────────────────────────────

  const [task, setTask] = useState<TaskViewDTO | null>(null);
  const [taskDetail, setTaskDetail] = useState<TaskDetailViewDTO | null>(null);
  const [nextInLine, setNextInLine] = useState<NextInLineItemDTO[]>([]);
  const [documents, setDocuments] = useState<DocumentViewDTO[]>([]);
  const [subcontractorInfo, setSubcontractorInfo] = useState<SubcontractorInfo | null>(null);
  const [linkedInvoice, setLinkedInvoice] = useState<InvoiceViewDTO | null>(null);
  const [hasQuotationRecord, setHasQuotationRecord] = useState(false);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);

  // Modal state
  const [showDelayModal, setShowDelayModal] = useState(false);
  const [showTaskPicker, setShowTaskPicker] = useState(false);
  const [showSubcontractorPicker, setShowSubcontractorPicker] = useState(false);
  const [showAddLogModal, setShowAddLogModal] = useState(false);
  const [editingLog, setEditingLog] = useState<ProgressLogViewDTO | null>(null);

  // ── Data loading ───────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (!getTaskDetailsUseCase) return;
      const dto = await getTaskDetailsUseCase.execute(taskId);
      if (!dto) return;
      setTask(dto.task);
      setTaskDetail(dto.taskDetail as unknown as TaskDetail);
      setNextInLine(dto.nextInLine);
      setDocuments(dto.documents);
      setLinkedInvoice(dto.linkedInvoice);
      setHasQuotationRecord(dto.hasQuotationRecord);
      setSubcontractorInfo(dto.subcontractorInfo);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [taskId, getTaskDetailsUseCase]);

  const autoTriggered = useRef(false);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadData();
    });
    loadData();
    return unsubscribe;
  }, [navigation, loadData]);

  // Auto-open modal / picker from params (one-shot, fired after first load)
  useEffect(() => {
    if (loading) return;
    if (autoTriggered.current) return;
    autoTriggered.current = true;
    if (autoOpen?.progressLog) {
      setShowAddLogModal(true);
    } else if (autoOpen?.document) {
      handleAddDocument();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // ── Action handlers ────────────────────────────────────────────────────────

  const handleComplete = useCallback(async () => {
    if (!task) return;
    setCompleting(true);
    try {
      await completeTask(task.id);
      navigation.goBack();
    } catch (err) {
      if (err instanceof PendingPaymentsForTaskError) {
        const paymentLines = err.pendingPayments
          .map((p) => {
            const amount = p.amount != null ? `$${p.amount.toLocaleString()}` : 'Unknown amount';
            const contractor = p.contractorName ?? 'Unknown contractor';
            const due = p.dueDate ? `Due: ${p.dueDate}` : '';
            return `\u2022 ${amount} \u2014 ${contractor}${due ? `\n  ${due}` : ''}`;
          })
          .join('\n');
        const capturedTaskId = task.id;
        Alert.alert(
          'Unpaid Payment Detected',
          `This task has an unpaid payment:\n\n${paymentLines}\n\nMark the payment as paid and complete this task?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Mark as Paid & Complete',
              style: 'default',
              onPress: async () => {
                setCompleting(true);
                try {
                  await completeTaskAndSettlePayments(capturedTaskId);
                  navigation.goBack();
                } catch {
                  Alert.alert('Error', 'Something went wrong. Please try again.');
                } finally {
                  setCompleting(false);
                }
              },
            },
          ],
        );
      } else if (err instanceof TaskCompletionValidationError) {
        const refs = err.pendingQuotations.map((q) => q.reference).join('\n\u2022 ');
        Alert.alert(
          'Cannot Mark as Complete',
          `The following quotations are still unresolved:\n\n\u2022 ${refs}\n\nPlease accept or decline each quotation before completing this task.`,
          [{ text: 'OK' }],
        );
      } else {
        Alert.alert('Error', 'Something went wrong. Please try again.');
      }
    } finally {
      setCompleting(false);
    }
  }, [task, completeTask, completeTaskAndSettlePayments, navigation]);

  const handleDelete = useCallback(async () => {
    const confirmed = await confirm({
      title: 'Delete Task',
      message: 'Are you sure you want to delete this task?',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await deleteTask(taskId);
      navigation.goBack();
    } catch {
      Alert.alert('Error', 'Failed to delete task');
    }
  }, [confirm, deleteTask, taskId, navigation]);

  const handleStatusChange = useCallback(
    async (status: TaskStatus) => {
      if (!task) return;
      setTask({ ...task, status });
      try {
        await updateTask(task.id, { status });
        await Promise.all(
          invalidations
            .taskEdited({ projectId: task.projectId ?? '', taskId: task.id })
            .map((key) => queryClient.invalidateQueries({ queryKey: key })),
        );
      } catch {
        setTask(task);
      }
    },
    [task, updateTask, queryClient],
  );

  const handlePriorityChange = useCallback(
    async (priority: TaskPriority) => {
      if (!task) return;
      setTask({ ...task, priority });
      try {
        await updateTask(task.id, { priority });
        await Promise.all(
          invalidations
            .taskEdited({ projectId: task.projectId ?? '', taskId: task.id })
            .map((key) => queryClient.invalidateQueries({ queryKey: key })),
        );
      } catch {
        setTask(task);
      }
    },
    [task, updateTask, queryClient],
  );

  const handleAddDelayReason = useCallback(
    async (data: AddDelayReasonFormData) => {
      try {
        await addDelayReason(taskId, data);
        setShowDelayModal(false);
        await loadData();
      } catch (e: any) {
        Alert.alert('Error', e?.message || 'Failed to add delay reason');
      }
    },
    [addDelayReason, taskId, loadData],
  );

  const handleRemoveDependency = useCallback(
    async (dependsOnTaskId: string) => {
      const confirmed = await confirm({
        title: 'Remove Dependency',
        message: 'Remove this dependency?',
        confirmLabel: 'Remove',
        destructive: true,
      });
      if (!confirmed) return;
      try {
        await removeDependency(taskId, dependsOnTaskId);
        await loadData();
      } catch (e: any) {
        Alert.alert('Error', e?.message || 'Failed to remove dependency');
      }
    },
    [confirm, removeDependency, taskId, loadData],
  );

  const handleAddDependency = useCallback(
    async (selectedTaskId: string) => {
      try {
        await addDependency(taskId, selectedTaskId);
        await loadData();
      } catch (e: any) {
        Alert.alert('Error', e?.message || 'Failed to add dependency');
      }
    },
    [addDependency, taskId, loadData],
  );

  const handleAddProgressLog = useCallback(
    async (data: AddProgressLogFormData) => {
      try {
        await addProgressLog(taskId, data);
        setShowAddLogModal(false);
        await loadData();
      } catch (e: any) {
        Alert.alert('Error', e?.message || 'Failed to add progress log');
      }
    },
    [addProgressLog, taskId, loadData],
  );

  const handleUpdateProgressLog = useCallback(
    async (data: AddProgressLogFormData) => {
      if (!editingLog) return;
      try {
        await updateProgressLog(taskId, editingLog.id, data);
        setEditingLog(null);
        await loadData();
      } catch (e: any) {
        Alert.alert('Error', e?.message || 'Failed to update progress log');
      }
    },
    [updateProgressLog, taskId, editingLog, loadData],
  );

  const handleDeleteProgressLog = useCallback(
    async (logId: string) => {
      try {
        await deleteProgressLog(taskId, logId);
        await loadData();
      } catch (e: any) {
        Alert.alert('Error', e?.message || 'Failed to delete progress log');
      }
    },
    [deleteProgressLog, taskId, loadData],
  );

  const handleAddDocument = useCallback(async () => {
    if (!filePickerAdapter || !addTaskDocumentUseCase) return;
    try {
      const result = await filePickerAdapter.pickDocument();
      if (result.cancelled || !result.uri || !result.name) return;
      setUploadingDocument(true);
      await addTaskDocumentUseCase.execute({
        taskId,
        projectId: task?.projectId,
        sourceUri: result.uri,
        filename: result.name,
        mimeType: result.type,
        size: result.size,
      });
      await Promise.all(
        invalidations
          .documentMutated({ taskId })
          .map((key) => queryClient.invalidateQueries({ queryKey: key })),
      );
      await loadData();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to add document');
    } finally {
      setUploadingDocument(false);
    }
  }, [filePickerAdapter, addTaskDocumentUseCase, taskId, task, queryClient, loadData]);

  const handleSubcontractorSelect = useCallback(
    async (contact: SubcontractorContact | undefined) => {
      if (!task) return;
      try {
        await updateTask(task.id, { subcontractorId: contact?.id });
        setTask({ ...task, subcontractorId: contact?.id });
        if (task.projectId) {
          await Promise.all(
            invalidations
              .taskEdited({ projectId: task.projectId, taskId: task.id })
              .map((key) => queryClient.invalidateQueries({ queryKey: key })),
          );
        }
        await loadData();
      } catch {
        Alert.alert('Error', 'Failed to update subcontractor');
      }
    },
    [task, updateTask, queryClient, loadData],
  );

  // ── Modal toggles ──────────────────────────────────────────────────────────

  const openDelayModal = useCallback(() => setShowDelayModal(true), []);
  const closeDelayModal = useCallback(() => setShowDelayModal(false), []);
  const openTaskPicker = useCallback(() => setShowTaskPicker(true), []);
  const closeTaskPicker = useCallback(() => setShowTaskPicker(false), []);
  const openSubcontractorPicker = useCallback(() => setShowSubcontractorPicker(true), []);
  const closeSubcontractorPicker = useCallback(() => setShowSubcontractorPicker(false), []);
  const openAddLogModal = useCallback(() => setShowAddLogModal(true), []);
  const closeAddLogModal = useCallback(() => setShowAddLogModal(false), []);

  // ── Return View-Model ──────────────────────────────────────────────────────

  return {
    // Data state
    task,
    taskDetail,
    nextInLine,
    documents,
    subcontractorInfo,
    linkedInvoice,
    hasQuotationRecord,
    loading,
    completing,
    uploadingDocument,

    // Modal state
    showDelayModal,
    showTaskPicker,
    showSubcontractorPicker,
    showAddLogModal,
    editingLog,

    // Derived helpers
    isCompleted: task?.status === 'completed',
    delayReasonTypes,

    // Actions
    handleComplete,
    handleDelete,
    handleStatusChange,
    handlePriorityChange,
    handleAddDelayReason,
    handleAddDependency,
    handleRemoveDependency,
    handleAddProgressLog,
    handleUpdateProgressLog,
    handleDeleteProgressLog,
    handleAddDocument,
    handleSubcontractorSelect,

    // Modal toggles
    openDelayModal,
    closeDelayModal,
    openTaskPicker,
    closeTaskPicker,
    openSubcontractorPicker,
    closeSubcontractorPicker,
    openAddLogModal,
    closeAddLogModal,
    setEditingLog,
  };
}
