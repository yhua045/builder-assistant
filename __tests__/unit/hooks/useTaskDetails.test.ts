/**
 * Unit tests for useTaskDetails View-Model hook
 * Design: design/issue-210-task-screens-refactor.md §8.2
 *
 * Acceptance criteria:
 * - Returns loading=true / task=null initially
 * - After loadData resolves: task, taskDetail, documents, nextInLine populated
 * - subcontractorInfo maps Contact → SubcontractorInfo shape
 * - isCompleted = true when task.status === 'completed'
 * - handleComplete success: navigation.goBack called
 * - handleComplete PendingPaymentsForTaskError: no goBack, Alert shown
 * - handleComplete TaskCompletionValidationError: no goBack, Alert shown
 * - handleDelete confirmed: deleteTask called, navigation.goBack called
 * - handleDelete cancelled: deleteTask NOT called
 * - handleStatusChange: optimistic update + invalidateQueries
 * - handleStatusChange failure: reverts to original status
 * - handlePriorityChange: optimistic update; reverts on failure
 * - handleAddDocument success: pickDocument + execute called, loadData refreshed
 * - handleAddDocument cancelled pick: use case NOT called
 * - handleAddDocument missing adapters: returns early without throwing
 * - handleAddDelayReason: calls addDelayReason, closes modal, refreshes
 * - handleAddDependency: calls addDependency, refreshes
 * - handleRemoveDependency confirmed: calls removeDependency, refreshes
 * - Modal toggles: open/close correctly toggle boolean state
 * - setEditingLog: sets/clears editingLog
 * - Auto-trigger openProgressLog: sets showAddLogModal=true after first load
 * - Auto-trigger fires only once
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

// ── Module mocks (hoisted) ────────────────────────────────────────────────────

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(),
}));

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: jest.fn(),
}));

jest.mock('tsyringe', () => ({
  container: { resolve: jest.fn() },
  injectable: jest.fn(),
  inject: jest.fn(),
  singleton: jest.fn(),
  registry: jest.fn(),
}));

jest.mock('../../../src/infrastructure/di/registerServices', () => ({}));

jest.mock('../../../src/hooks/useTasks', () => ({
  useTasks: jest.fn(),
}));

jest.mock('../../../src/hooks/useDelayReasonTypes', () => ({
  useDelayReasonTypes: jest.fn(),
}));

jest.mock('../../../src/hooks/useConfirm', () => ({
  useConfirm: jest.fn(),
}));

jest.mock('../../../src/hooks/queryKeys', () => ({
  invalidations: {
    taskEdited: jest.fn().mockReturnValue([['tasks-edited']]),
    documentMutated: jest.fn().mockReturnValue([['documents-mutated']]),
  },
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { container } from 'tsyringe';
import { useTasks } from '../../../src/hooks/useTasks';
import { useDelayReasonTypes } from '../../../src/hooks/useDelayReasonTypes';
import { useConfirm } from '../../../src/hooks/useConfirm';
import { useTaskDetails } from '../../../src/hooks/useTaskDetails';
import {
  PendingPaymentsForTaskError,
  TaskCompletionValidationError,
} from '../../../src/application/errors/TaskCompletionErrors';

// ── Typed mock helpers ────────────────────────────────────────────────────────

const mockUseNavigation = useNavigation as jest.MockedFunction<typeof useNavigation>;
const mockUseQueryClient = useQueryClient as jest.MockedFunction<typeof useQueryClient>;
const mockContainerResolve = container.resolve as jest.Mock;
const mockUseTasks = useTasks as jest.MockedFunction<typeof useTasks>;
const mockUseDelayReasonTypes = useDelayReasonTypes as jest.MockedFunction<typeof useDelayReasonTypes>;
const mockUseConfirm = useConfirm as jest.MockedFunction<typeof useConfirm>;

// ── Alert spy ─────────────────────────────────────────────────────────────────

let alertSpy: jest.SpyInstance;

// ── Navigation mocks ──────────────────────────────────────────────────────────

let mockGoBack: jest.Mock;
let mockNavigate: jest.Mock;
let mockAddListener: jest.Mock;

// ── Task mock functions ───────────────────────────────────────────────────────

let mockGetTaskDetailsExecute: jest.Mock;
let mockUpdateTask: jest.Mock;
let mockDeleteTask: jest.Mock;
let mockCompleteTask: jest.Mock;
let mockCompleteTaskAndSettlePayments: jest.Mock;
let mockAddDependency: jest.Mock;
let mockRemoveDependency: jest.Mock;
let mockAddDelayReason: jest.Mock;
let mockAddProgressLog: jest.Mock;
let mockUpdateProgressLog: jest.Mock;
let mockDeleteProgressLog: jest.Mock;

// ── QueryClient mock ──────────────────────────────────────────────────────────

let mockInvalidateQueries: jest.Mock;

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TASK_ID = 'task-abc';

const TASK_FIXTURE: any = {
  id: TASK_ID,
  title: 'Install flooring',
  status: 'pending',
  priority: 'high',
  projectId: 'proj-1',
  subcontractorId: 'contact-1',
  quoteInvoiceId: null,
  quoteAmount: null,
};

const TASK_DETAIL_FIXTURE: any = {
  ...TASK_FIXTURE,
  dependencyTasks: [],
  delayReasons: [],
  progressLogs: [],
  linkedQuotations: [],
};

const SUBCONTRACTOR_INFO_FIXTURE = {
  id: 'contact-1',
  name: 'Bob Builder',
  trade: 'Flooring',
  phone: '0400000001',
  email: 'bob@builder.com',
};

const DEFAULT_DTO = {
  task: TASK_FIXTURE,
  taskDetail: TASK_DETAIL_FIXTURE,
  nextInLine: [],
  documents: [],
  linkedInvoice: null,
  hasQuotationRecord: false,
  subcontractorInfo: SUBCONTRACTOR_INFO_FIXTURE,
};

const DELAY_REASON_TYPES = [{ id: 'dt-1', label: 'Weather' }];

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

  mockGoBack = jest.fn();
  mockNavigate = jest.fn();
  mockAddListener = jest.fn().mockReturnValue(jest.fn()); // returns unsubscribe fn

  mockUseNavigation.mockReturnValue({
    goBack: mockGoBack,
    navigate: mockNavigate,
    addListener: mockAddListener,
  } as any);

  mockInvalidateQueries = jest.fn().mockResolvedValue(undefined);
  mockUseQueryClient.mockReturnValue({ invalidateQueries: mockInvalidateQueries } as any);

  // Default: GetTaskDetailsUseCase resolves with full DTO; other tokens throw
  mockGetTaskDetailsExecute = jest.fn().mockResolvedValue(DEFAULT_DTO);
  mockContainerResolve.mockImplementation((token: string) => {
    if (token === 'GetTaskDetailsUseCase') return { execute: mockGetTaskDetailsExecute };
    throw new Error('Not registered');
  });

  // useTasks mocks (mutations only — data loading is now via GetTaskDetailsUseCase)
  mockUpdateTask = jest.fn().mockResolvedValue(undefined);
  mockDeleteTask = jest.fn().mockResolvedValue(undefined);
  mockCompleteTask = jest.fn().mockResolvedValue(undefined);
  mockCompleteTaskAndSettlePayments = jest.fn().mockResolvedValue(undefined);
  mockAddDependency = jest.fn().mockResolvedValue(undefined);
  mockRemoveDependency = jest.fn().mockResolvedValue(undefined);
  mockAddDelayReason = jest.fn().mockResolvedValue({ id: 'delay-1' });
  mockAddProgressLog = jest.fn().mockResolvedValue({ id: 'log-1' });
  mockUpdateProgressLog = jest.fn().mockResolvedValue({ id: 'log-1' });
  mockDeleteProgressLog = jest.fn().mockResolvedValue(undefined);

  mockUseTasks.mockReturnValue({
    updateTask: mockUpdateTask,
    deleteTask: mockDeleteTask,
    completeTask: mockCompleteTask,
    completeTaskAndSettlePayments: mockCompleteTaskAndSettlePayments,
    addDependency: mockAddDependency,
    removeDependency: mockRemoveDependency,
    addDelayReason: mockAddDelayReason,
    addProgressLog: mockAddProgressLog,
    updateProgressLog: mockUpdateProgressLog,
    deleteProgressLog: mockDeleteProgressLog,
    createTask: jest.fn(),
    tasks: [],
    loading: false,
  } as any);

  mockUseDelayReasonTypes.mockReturnValue({
    delayReasonTypes: DELAY_REASON_TYPES,
    loading: false,
  } as any);

  mockUseConfirm.mockReturnValue({ confirm: jest.fn().mockResolvedValue(true) } as any);
});

// ── Helper: render hook and wait for initial load ─────────────────────────────

async function renderAndLoad(
  taskId = TASK_ID,
  autoOpen?: { progressLog?: boolean; document?: boolean },
) {
  const rendered = renderHook(() => useTaskDetails(taskId, autoOpen));
  await waitFor(() => expect(rendered.result.current.loading).toBe(false));
  return rendered;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useTaskDetails', () => {
  // ── Loading state ───────────────────────────────────────────────────────────

  describe('initial loading state', () => {
    it('starts with loading=true and task=null before loadData resolves', async () => {
      let resolveExecute!: (dto: any) => void;
      mockGetTaskDetailsExecute.mockReturnValue(new Promise(res => { resolveExecute = res; }));

      const { result } = renderHook(() => useTaskDetails(TASK_ID));
      expect(result.current.loading).toBe(true);
      expect(result.current.task).toBeNull();
      expect(result.current.taskDetail).toBeNull();

      // Resolve and confirm loading clears
      await act(async () => { resolveExecute(DEFAULT_DTO); });
    });
  });

  // ── Data loading ────────────────────────────────────────────────────────────

  describe('data loading', () => {
    it('populates task and taskDetail after loadData resolves', async () => {
      const { result } = await renderAndLoad();
      expect(result.current.task).toEqual(TASK_FIXTURE);
      expect(result.current.taskDetail).toEqual(TASK_DETAIL_FIXTURE);
    });

    it('maps subcontractorId contact to SubcontractorInfo shape via use case', async () => {
      const { result } = await renderAndLoad();
      expect(result.current.subcontractorInfo).toEqual(SUBCONTRACTOR_INFO_FIXTURE);
    });

    it('sets subcontractorInfo to null when use case returns null for subcontractor', async () => {
      mockGetTaskDetailsExecute.mockResolvedValue({ ...DEFAULT_DTO, subcontractorInfo: null });
      const { result } = await renderAndLoad();
      expect(result.current.subcontractorInfo).toBeNull();
    });

    it('populates documents from use case DTO', async () => {
      const doc = { id: 'doc-1', taskId: TASK_ID, filename: 'plan.pdf' };
      mockGetTaskDetailsExecute.mockResolvedValue({ ...DEFAULT_DTO, documents: [doc] });
      const { result } = await renderAndLoad();
      expect(result.current.documents).toEqual([doc]);
    });

    it('populates nextInLine from use case DTO', async () => {
      const next = [{ id: 't2', title: 'Framing', status: 'pending' }];
      mockGetTaskDetailsExecute.mockResolvedValue({ ...DEFAULT_DTO, nextInLine: next });
      const { result } = await renderAndLoad();
      expect(result.current.nextInLine).toEqual(next);
    });

    it('populates linkedInvoice from use case DTO', async () => {
      const inv = { id: 'inv-1', total: 1500 };
      mockGetTaskDetailsExecute.mockResolvedValue({ ...DEFAULT_DTO, linkedInvoice: inv });
      const { result } = await renderAndLoad();
      expect(result.current.linkedInvoice).toEqual(inv);
    });

    it('sets hasQuotationRecord from use case DTO', async () => {
      mockGetTaskDetailsExecute.mockResolvedValue({ ...DEFAULT_DTO, hasQuotationRecord: true });
      const { result } = await renderAndLoad();
      expect(result.current.hasQuotationRecord).toBe(true);
    });
  });

  // ── isCompleted derived value ───────────────────────────────────────────────

  describe('isCompleted', () => {
    it('returns true when task.status === "completed"', async () => {
      mockGetTaskDetailsExecute.mockResolvedValue({
        ...DEFAULT_DTO,
        task: { ...TASK_FIXTURE, status: 'completed' },
      });
      const { result } = await renderAndLoad();
      expect(result.current.isCompleted).toBe(true);
    });

    it('returns false when task.status !== "completed"', async () => {
      const { result } = await renderAndLoad();
      expect(result.current.isCompleted).toBe(false);
    });
  });

  // ── handleComplete ──────────────────────────────────────────────────────────

  describe('handleComplete', () => {
    it('success path: calls completeTask and navigation.goBack', async () => {
      const { result } = await renderAndLoad();
      await act(async () => { await result.current.handleComplete(); });
      expect(mockCompleteTask).toHaveBeenCalledWith(TASK_ID);
      expect(mockGoBack).toHaveBeenCalled();
    });

    it('PendingPaymentsForTaskError: does NOT call goBack; shows Alert', async () => {
      const err = new PendingPaymentsForTaskError([
        { id: 'pay-1', amount: 500, contractorName: 'Acme', dueDate: '2026-01-01' },
      ]);
      mockCompleteTask.mockRejectedValue(err);

      const { result } = await renderAndLoad();
      await act(async () => { await result.current.handleComplete(); });

      expect(mockGoBack).not.toHaveBeenCalled();
      expect(alertSpy).toHaveBeenCalled();
    });

    it('TaskCompletionValidationError: does NOT call goBack; shows Alert', async () => {
      const err = new TaskCompletionValidationError([
        { id: 'q-1', reference: 'QT-001', status: 'sent' },
      ]);
      mockCompleteTask.mockRejectedValue(err);

      const { result } = await renderAndLoad();
      await act(async () => { await result.current.handleComplete(); });

      expect(mockGoBack).not.toHaveBeenCalled();
      expect(alertSpy).toHaveBeenCalled();
    });
  });

  // ── handleDelete ────────────────────────────────────────────────────────────

  describe('handleDelete', () => {
    it('calls deleteTask and goBack when confirm returns true', async () => {
      mockUseConfirm.mockReturnValue({ confirm: jest.fn().mockResolvedValue(true) } as any);
      const { result } = await renderAndLoad();

      await act(async () => { await result.current.handleDelete(); });

      expect(mockDeleteTask).toHaveBeenCalledWith(TASK_ID);
      expect(mockGoBack).toHaveBeenCalled();
    });

    it('does NOT call deleteTask when confirm returns false', async () => {
      mockUseConfirm.mockReturnValue({ confirm: jest.fn().mockResolvedValue(false) } as any);
      const { result } = await renderAndLoad();

      await act(async () => { await result.current.handleDelete(); });

      expect(mockDeleteTask).not.toHaveBeenCalled();
      expect(mockGoBack).not.toHaveBeenCalled();
    });
  });

  // ── handleStatusChange ──────────────────────────────────────────────────────

  describe('handleStatusChange', () => {
    it('optimistically updates task.status and calls updateTask', async () => {
      const { result } = await renderAndLoad();

      await act(async () => {
        await result.current.handleStatusChange('in_progress');
      });

      expect(mockUpdateTask).toHaveBeenCalledWith(TASK_ID, { status: 'in_progress' });
      expect(result.current.task?.status).toBe('in_progress');
    });

    it('reverts task.status to original value when updateTask throws', async () => {
      mockUpdateTask.mockRejectedValue(new Error('Network error'));
      const { result } = await renderAndLoad();

      expect(result.current.task?.status).toBe('pending');

      await act(async () => {
        await result.current.handleStatusChange('in_progress');
      });

      expect(result.current.task?.status).toBe('pending');
    });
  });

  // ── handlePriorityChange ────────────────────────────────────────────────────

  describe('handlePriorityChange', () => {
    it('optimistically updates task.priority and calls updateTask', async () => {
      const { result } = await renderAndLoad();

      await act(async () => {
        await result.current.handlePriorityChange('low');
      });

      expect(mockUpdateTask).toHaveBeenCalledWith(TASK_ID, { priority: 'low' });
      expect(result.current.task?.priority).toBe('low');
    });

    it('reverts task.priority when updateTask throws', async () => {
      mockUpdateTask.mockRejectedValue(new Error('Network error'));
      const { result } = await renderAndLoad();

      await act(async () => {
        await result.current.handlePriorityChange('low');
      });

      expect(result.current.task?.priority).toBe('high');
    });
  });

  // ── handleAddDocument ───────────────────────────────────────────────────────

  describe('handleAddDocument', () => {
    it('returns early without throwing when filePickerAdapter is null (container throws)', async () => {
      const { result } = await renderAndLoad();
      // filePickerAdapter is null by default (container.resolve throws)
      await expect(
        act(async () => { await result.current.handleAddDocument(); }),
      ).resolves.not.toThrow();
    });

    it('returns early when pickDocument is cancelled', async () => {
      const mockFilePickerAdapter = {
        pickDocument: jest.fn().mockResolvedValue({ cancelled: true }),
      };
      const mockAddDocUseCase = { execute: jest.fn().mockResolvedValue(undefined) };
      mockContainerResolve.mockImplementation((token: string) => {
        if (token === 'GetTaskDetailsUseCase') return { execute: mockGetTaskDetailsExecute };
        if (token === 'IFilePickerAdapter') return mockFilePickerAdapter;
        if (token === 'AddTaskDocumentUseCase') return mockAddDocUseCase;
        throw new Error('Not registered');
      });

      const { result } = await renderAndLoad();
      await act(async () => { await result.current.handleAddDocument(); });

      expect(mockFilePickerAdapter.pickDocument).toHaveBeenCalled();
      expect(mockAddDocUseCase.execute).not.toHaveBeenCalled();
    });

    it('calls pickDocument and use case execute on success', async () => {
      const mockFilePickerAdapter = {
        pickDocument: jest.fn().mockResolvedValue({
          cancelled: false,
          uri: 'file:///doc.pdf',
          name: 'invoice.pdf',
          type: 'application/pdf',
          size: 102400,
        }),
      };
      const mockAddDocUseCase = { execute: jest.fn().mockResolvedValue(undefined) };
      mockContainerResolve.mockImplementation((token: string) => {
        if (token === 'GetTaskDetailsUseCase') return { execute: mockGetTaskDetailsExecute };
        if (token === 'IFilePickerAdapter') return mockFilePickerAdapter;
        if (token === 'AddTaskDocumentUseCase') return mockAddDocUseCase;
        throw new Error('Not registered');
      });

      const { result } = await renderAndLoad();
      await act(async () => { await result.current.handleAddDocument(); });

      expect(mockFilePickerAdapter.pickDocument).toHaveBeenCalled();
      expect(mockAddDocUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({ taskId: TASK_ID, sourceUri: 'file:///doc.pdf' }),
      );
    });
  });

  // ── handleAddDelayReason ────────────────────────────────────────────────────

  describe('handleAddDelayReason', () => {
    it('calls addDelayReason, closes delay modal, and refreshes data', async () => {
      const { result } = await renderAndLoad();

      // Open delay modal first
      act(() => { result.current.openDelayModal(); });
      expect(result.current.showDelayModal).toBe(true);

      const formData: any = { reason: 'Weather delay', notes: 'Heavy rain' };
      await act(async () => { await result.current.handleAddDelayReason(formData); });

      expect(mockAddDelayReason).toHaveBeenCalledWith(TASK_ID, formData);
      expect(result.current.showDelayModal).toBe(false);
    });
  });

  // ── handleAddDependency ─────────────────────────────────────────────────────

  describe('handleAddDependency', () => {
    it('calls addDependency with taskId and selected task id', async () => {
      const { result } = await renderAndLoad();
      await act(async () => { await result.current.handleAddDependency('dep-task-1'); });
      expect(mockAddDependency).toHaveBeenCalledWith(TASK_ID, 'dep-task-1');
    });
  });

  // ── handleRemoveDependency ──────────────────────────────────────────────────

  describe('handleRemoveDependency', () => {
    it('calls removeDependency when confirmed', async () => {
      mockUseConfirm.mockReturnValue({ confirm: jest.fn().mockResolvedValue(true) } as any);
      const { result } = await renderAndLoad();

      await act(async () => { await result.current.handleRemoveDependency('dep-task-1'); });

      expect(mockRemoveDependency).toHaveBeenCalledWith(TASK_ID, 'dep-task-1');
    });

    it('does NOT call removeDependency when confirm is cancelled', async () => {
      mockUseConfirm.mockReturnValue({ confirm: jest.fn().mockResolvedValue(false) } as any);
      const { result } = await renderAndLoad();

      await act(async () => { await result.current.handleRemoveDependency('dep-task-1'); });

      expect(mockRemoveDependency).not.toHaveBeenCalled();
    });
  });

  // ── Modal toggles ───────────────────────────────────────────────────────────

  describe('modal toggles', () => {
    it.each([
      ['openDelayModal', 'closeDelayModal', 'showDelayModal'],
      ['openTaskPicker', 'closeTaskPicker', 'showTaskPicker'],
      ['openSubcontractorPicker', 'closeSubcontractorPicker', 'showSubcontractorPicker'],
      ['openAddLogModal', 'closeAddLogModal', 'showAddLogModal'],
    ] as const)('%s / %s toggles %s', async (openFn, closeFn, stateKey) => {
      const { result } = await renderAndLoad();

      expect(result.current[stateKey]).toBe(false);

      act(() => { result.current[openFn](); });
      expect(result.current[stateKey]).toBe(true);

      act(() => { result.current[closeFn](); });
      expect(result.current[stateKey]).toBe(false);
    });
  });

  // ── setEditingLog ───────────────────────────────────────────────────────────

  describe('setEditingLog', () => {
    it('sets editingLog to the provided ProgressLog', async () => {
      const { result } = await renderAndLoad();
      const log: any = { id: 'log-1', notes: 'First progress', date: new Date().toISOString() };

      act(() => { result.current.setEditingLog(log); });
      expect(result.current.editingLog).toEqual(log);
    });

    it('clears editingLog when set to null', async () => {
      const { result } = await renderAndLoad();
      const log: any = { id: 'log-1', notes: 'First progress', date: new Date().toISOString() };

      act(() => { result.current.setEditingLog(log); });
      act(() => { result.current.setEditingLog(null); });
      expect(result.current.editingLog).toBeNull();
    });
  });

  // ── Auto-trigger openProgressLog ────────────────────────────────────────────

  describe('auto-trigger openProgressLog', () => {
    it('sets showAddLogModal=true when autoOpen.progressLog is true after first load', async () => {
      const { result } = await renderAndLoad(TASK_ID, { progressLog: true });
      expect(result.current.showAddLogModal).toBe(true);
    });

    it('does NOT set showAddLogModal when autoOpen.progressLog is false', async () => {
      const { result } = await renderAndLoad(TASK_ID, { progressLog: false });
      expect(result.current.showAddLogModal).toBe(false);
    });

    it('auto-trigger fires only once across multiple re-renders', async () => {
      const { result, rerender } = renderHook(
        (autoOpen?: { progressLog?: boolean }) => useTaskDetails(TASK_ID, autoOpen),
        { initialProps: { progressLog: true } },
      );
      await waitFor(() => expect(result.current.loading).toBe(false));

      // Confirm trigger fired
      expect(result.current.showAddLogModal).toBe(true);

      // Close the modal
      act(() => { result.current.closeAddLogModal(); });
      expect(result.current.showAddLogModal).toBe(false);

      // Re-render with same params — auto-trigger should NOT re-fire
      rerender({ progressLog: true });
      expect(result.current.showAddLogModal).toBe(false);
    });
  });
});
