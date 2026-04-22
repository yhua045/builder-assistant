/**
 * Integration tests for TaskDetailsPage — layer-purity assertions and rendering behaviour.
 * Design: design/issue-210-task-screens-refactor.md §8.4
 *
 * Acceptance criteria:
 * - Zero infrastructure/ imports in the component source
 * - Zero tsyringe container import in the component source
 * - Zero application/usecases/ imports in the component source
 * - Loading state: ActivityIndicator rendered when vm.loading=true
 * - Not-found state: "Task not found" rendered when vm.task=null and loading=false
 * - Completed task: "Mark as Completed" button is NOT rendered when vm.isCompleted=true
 * - Delete Pressable calls vm.handleDelete
 * - "Mark as Completed" button calls vm.handleComplete
 */

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import fs from 'fs';
import path from 'path';

// ── Mock navigation ───────────────────────────────────────────────────────────

jest.mock('@react-navigation/native', () => ({
  useRoute: jest.fn(),
  useNavigation: jest.fn(),
}));

// ── Mock sub-components (keep rendering minimal) ──────────────────────────────

jest.mock('lucide-react-native', () => ({
  Edit: 'Edit',
  Trash2: 'Trash2',
  Calendar: 'Calendar',
  Clock: 'Clock',
  ArrowLeft: 'ArrowLeft',
  FileText: 'FileText',
  CheckCircle: 'CheckCircle',
  cssInterop: jest.fn(),
}));

jest.mock('nativewind', () => ({
  cssInterop: jest.fn(),
  useColorScheme: () => ({ colorScheme: 'light' }),
}));

jest.mock('../../../src/components/tasks/TaskStatusBadge', () => ({
  TaskStatusBadge: () => null,
}));

jest.mock('../../../src/components/tasks/StatusPriorityRow', () => ({
  StatusPriorityRow: () => null,
}));

jest.mock('../../../src/components/tasks/TaskDocumentSection', () => ({
  TaskDocumentSection: () => null,
}));

jest.mock('../../../src/components/tasks/TaskDependencySection', () => ({
  TaskDependencySection: () => null,
}));

jest.mock('../../../src/components/tasks/TaskSubcontractorSection', () => ({
  TaskSubcontractorSection: () => null,
}));

jest.mock('../../../src/components/tasks/TaskProgressSection', () => ({
  TaskProgressSection: () => null,
}));

jest.mock('../../../src/components/tasks/TaskQuotationSection', () => ({
  TaskQuotationSection: () => null,
}));

jest.mock('../../../src/components/tasks/AddDelayReasonModal', () => ({
  AddDelayReasonModal: () => null,
}));

jest.mock('../../../src/components/tasks/AddProgressLogModal', () => ({
  AddProgressLogModal: () => null,
}));

jest.mock('../../../src/pages/tasks/TaskPickerModal', () => ({
  TaskPickerModal: () => null,
}));

jest.mock('../../../src/components/tasks/SubcontractorPickerModal', () => ({
  SubcontractorPickerModal: () => null,
}));

// ── Mock the single View-Model hook ───────────────────────────────────────────

jest.mock('../../../src/hooks/useTaskDetails', () => ({
  useTaskDetails: jest.fn(),
}));

import { useRoute, useNavigation } from '@react-navigation/native';
import { useTaskDetails } from '../../../src/hooks/useTaskDetails';
import type { TaskDetailsViewModel } from '../../../src/hooks/useTaskDetails';
import TaskDetailsPage from '../../../src/pages/tasks/TaskDetailsPage';

const mockUseRoute = useRoute as jest.MockedFunction<typeof useRoute>;
const mockUseNavigation = useNavigation as jest.MockedFunction<typeof useNavigation>;
const mockUseTaskDetails = useTaskDetails as jest.MockedFunction<typeof useTaskDetails>;

// ── Default view-model ────────────────────────────────────────────────────────

const TASK_FIXTURE: any = {
  id: 'task-1',
  title: 'Install flooring',
  status: 'pending' as const,
  priority: 'high' as const,
  projectId: 'proj-1',
  subcontractorId: null,
  startDate: null,
  dueDate: null,
  notes: null,
  quoteInvoiceId: null,
  quoteAmount: null,
};

function makeDefaultVm(
  overrides: Partial<TaskDetailsViewModel> = {},
): TaskDetailsViewModel {
  return {
    task: TASK_FIXTURE,
    taskDetail: null,
    nextInLine: [],
    documents: [],
    subcontractorInfo: null,
    linkedInvoice: null,
    hasQuotationRecord: false,
    loading: false,
    completing: false,
    uploadingDocument: false,
    showDelayModal: false,
    showTaskPicker: false,
    showSubcontractorPicker: false,
    showAddLogModal: false,
    editingLog: null,
    isCompleted: false,
    delayReasonTypes: [],
    handleComplete: jest.fn(),
    handleDelete: jest.fn(),
    handleStatusChange: jest.fn(),
    handlePriorityChange: jest.fn(),
    handleAddDelayReason: jest.fn(),
    handleAddDependency: jest.fn(),
    handleRemoveDependency: jest.fn(),
    handleAddProgressLog: jest.fn(),
    handleUpdateProgressLog: jest.fn(),
    handleDeleteProgressLog: jest.fn(),
    handleAddDocument: jest.fn(),
    handleSubcontractorSelect: jest.fn(),
    openDelayModal: jest.fn(),
    closeDelayModal: jest.fn(),
    openTaskPicker: jest.fn(),
    closeTaskPicker: jest.fn(),
    openSubcontractorPicker: jest.fn(),
    closeSubcontractorPicker: jest.fn(),
    openAddLogModal: jest.fn(),
    closeAddLogModal: jest.fn(),
    setEditingLog: jest.fn(),
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TaskDetailsPage — layer purity', () => {
  const SOURCE_FILE = path.resolve(
    __dirname,
    '../../../src/pages/tasks/TaskDetailsPage.tsx',
  );

  it('does NOT import from infrastructure/ at any depth', () => {
    const source = fs.readFileSync(SOURCE_FILE, 'utf8');
    expect(source).not.toMatch(/from ['"].*infrastructure\//);
    expect(source).not.toMatch(/require\(['"].*infrastructure\//);
  });

  it('does NOT import container from tsyringe', () => {
    const source = fs.readFileSync(SOURCE_FILE, 'utf8');
    expect(source).not.toMatch(/from ['"]tsyringe['"]/);
    expect(source).not.toMatch(/require\(['"]tsyringe['"]\)/);
  });

  it('does NOT import from application/usecases/', () => {
    const source = fs.readFileSync(SOURCE_FILE, 'utf8');
    expect(source).not.toMatch(/from ['"].*application\/usecases\//);
    expect(source).not.toMatch(/require\(['"].*application\/usecases\//);
  });
});

describe('TaskDetailsPage — rendering', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockUseRoute.mockReturnValue({
      params: { taskId: 'task-1', openProgressLog: false, openDocument: false },
    } as any);

    mockUseNavigation.mockReturnValue({
      goBack: jest.fn(),
      navigate: jest.fn(),
      addListener: jest.fn().mockReturnValue(jest.fn()),
    } as any);

    mockUseTaskDetails.mockReturnValue(makeDefaultVm());
  });

  it('renders ActivityIndicator when vm.loading=true', () => {
    mockUseTaskDetails.mockReturnValue(makeDefaultVm({ loading: true, task: null }));

    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<TaskDetailsPage />);
    });

    const { ActivityIndicator } = require('react-native');
    const indicators = tree.root.findAllByType(ActivityIndicator);
    expect(indicators.length).toBeGreaterThan(0);
  });

  it('renders "Task not found" when vm.task=null and loading=false', () => {
    mockUseTaskDetails.mockReturnValue(makeDefaultVm({ task: null, loading: false }));

    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<TaskDetailsPage />);
    });

    const notFoundNodes = tree.root.findAllByProps({ children: 'Task not found' });
    expect(notFoundNodes.length).toBeGreaterThan(0);
  });

  it('does NOT render "Mark as Completed" button when vm.isCompleted=true', () => {
    mockUseTaskDetails.mockReturnValue(makeDefaultVm({ isCompleted: true }));

    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<TaskDetailsPage />);
    });

    const completeButtons = tree.root.findAllByProps({ testID: 'mark-as-complete-button' });
    expect(completeButtons.length).toBe(0);
  });

  it('renders "Mark as Completed" button when vm.isCompleted=false', () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<TaskDetailsPage />);
    });

    const btn = tree.root.findByProps({ testID: 'mark-as-complete-button' });
    expect(btn).toBeTruthy();
  });

  it('"Mark as Completed" button calls vm.handleComplete when pressed', () => {
    const handleComplete = jest.fn();
    mockUseTaskDetails.mockReturnValue(makeDefaultVm({ handleComplete }));

    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<TaskDetailsPage />);
    });

    const btn = tree.root.findByProps({ testID: 'mark-as-complete-button' });
    act(() => { btn.props.onPress(); });

    expect(handleComplete).toHaveBeenCalled();
  });

  it('delete Pressable calls vm.handleDelete when pressed', () => {
    const handleDelete = jest.fn();
    mockUseTaskDetails.mockReturnValue(makeDefaultVm({ handleDelete }));

    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<TaskDetailsPage />);
    });

    // Find the Pressable that has onPress set to vm.handleDelete
    const deleteButtons = tree.root.findAll(
      (el) => el.props && el.props.onPress === handleDelete,
    );
    expect(deleteButtons.length).toBeGreaterThan(0);

    act(() => { deleteButtons[0].props.onPress(); });
    expect(handleDelete).toHaveBeenCalled();
  });
});
