/**
 * Integration tests for voice task entry on CreateTaskPage and EditTaskPage.
 *
 * Strategy:
 * - Mock `useVoiceTask` hook at the module level so we can control its return
 *   value without spinning up a real IAudioRecorder or DI container.
 * - Mock `useTasks` so form submissions don't hit the database.
 * - Mock navigation hooks so pages render without a NavigationContainer.
 * - Verify that the Voice button is present and that, once a voice draft is
 *   "done", the task form is pre-filled with the draft values.
 *
 * Run: npx jest __tests__/integration/TaskPage.voice.integration.test.tsx
 */
import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

// ── Navigation stubs ──────────────────────────────────────────────────────────
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn() }),
  useRoute: () => ({ params: { taskId: 'task-1' } }),
}));

// ── DI container stub ─────────────────────────────────────────────────────────
jest.mock('tsyringe', () => ({
  container: { resolve: jest.fn() },
}));

// ── NativeWind / icon stubs ───────────────────────────────────────────────────
jest.mock('nativewind', () => ({
  cssInterop: jest.fn(),
  useColorScheme: () => ({ colorScheme: 'light' }),
}));
jest.mock('lucide-react-native', () => ({
  X: 'X',
  Save: 'Save',
  Trash2: 'Trash2',
  HardHat: 'HardHat',
  Phone: 'Phone',
  Mail: 'Mail',
  Pencil: 'Pencil',
  FileText: 'FileText',
  Plus: 'Plus',
  Link2: 'Link2',
  AlertTriangle: 'AlertTriangle',
  Users: 'Users',
}));

// ── Safe area stub ────────────────────────────────────────────────────────────
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: any) => children,
}));

// ── DatePickerInput stub ──────────────────────────────────────────────────────
jest.mock('../../src/components/inputs/DatePickerInput', () => {
  const { Text } = require('react-native');
  return ({ label }: any) => <Text>{label}</Text>;
});

// ── useTasks stub ─────────────────────────────────────────────────────────────
const mockCreateTask = jest.fn().mockResolvedValue(undefined);
const mockUpdateTask = jest.fn().mockResolvedValue(undefined);
const mockGetTask = jest.fn().mockResolvedValue({
  id: 'task-1',
  title: 'Existing task',
  notes: 'Old notes',
  priority: 'low',
  status: 'pending',
});

jest.mock('../../src/hooks/useTasks', () => ({
  useTasks: () => ({
    createTask: mockCreateTask,
    updateTask: mockUpdateTask,
    getTask: mockGetTask,
    loading: false,
    tasks: [],
  }),
}));

// ── useVoiceTask stub — starts idle; tests can override ───────────────────────
import type { VoiceTaskState } from '../../src/hooks/useVoiceTask';

const mockStartRecording = jest.fn();
const mockStopAndParse = jest.fn();
const mockCancel = jest.fn();

// Use an object so the factory closure always reads the latest value
const mockVoiceControl = {
  state: { phase: 'idle' } as VoiceTaskState,
  elapsedSeconds: 0,
};

jest.mock('../../src/hooks/useVoiceTask', () => {
  const original = jest.requireActual('../../src/hooks/useVoiceTask');
  return {
    ...original,
    useVoiceTask: () => ({
      state: mockVoiceControl.state,
      elapsedSeconds: mockVoiceControl.elapsedSeconds,
      maxSeconds: original.MAX_RECORDING_SECONDS,
      startRecording: mockStartRecording,
      stopAndParse: mockStopAndParse,
      cancel: mockCancel,
    }),
  };
});

// ── Pages under test ──────────────────────────────────────────────────────────
import CreateTaskPage from '../../src/pages/tasks/CreateTaskPage';
import EditTaskPage from '../../src/pages/tasks/EditTaskPage';
import { wrapWithQuery } from '../utils/queryClientWrapper';

// ─────────────────────────────────────────────────────────────────────────────

function resetVoiceState() {
  mockVoiceControl.state = { phase: 'idle' };
  mockVoiceControl.elapsedSeconds = 0;
  mockStartRecording.mockReset();
  mockStopAndParse.mockReset();
  mockCancel.mockReset();
  mockCreateTask.mockReset();
  mockCreateTask.mockResolvedValue(undefined);
  mockUpdateTask.mockReset();
  mockUpdateTask.mockResolvedValue(undefined);
  mockGetTask.mockReset();
  mockGetTask.mockResolvedValue({
    id: 'task-1',
    title: 'Existing task',
    notes: 'Old notes',
    priority: 'low',
    status: 'pending',
  });
}

// ─────────────────────────────────────────────────────────────────────────────
describe('CreateTaskPage — voice task entry', () => {
  beforeEach(resetVoiceState);

  it('renders the Voice button', () => {
    const { getByLabelText } = render(wrapWithQuery(<CreateTaskPage />));
    expect(getByLabelText('Start voice recording')).toBeTruthy();
  });

  it('calls startRecording when Voice button is tapped', async () => {
    const { getByLabelText } = render(wrapWithQuery(<CreateTaskPage />));
    await act(async () => {
      fireEvent.press(getByLabelText('Start voice recording'));
    });
    expect(mockStartRecording).toHaveBeenCalledTimes(1);
  });

  it('shows the overlay when phase is recording', () => {
    mockVoiceControl.state = { phase: 'recording' };
    const { getByLabelText } = render(wrapWithQuery(<CreateTaskPage />));
    expect(getByLabelText('Stop and transcribe')).toBeTruthy();
    expect(getByLabelText('Cancel recording')).toBeTruthy();
  });

  it('shows the overlay when phase is parsing', () => {
    mockVoiceControl.state = { phase: 'parsing' };
    const { queryByText } = render(wrapWithQuery(<CreateTaskPage />));
    expect(queryByText(/Analysing/)).toBeTruthy();
  });

  it('pre-fills the form with the voice draft once phase is done', async () => {
    mockVoiceControl.state = { phase: 'done', draft: { title: 'Install plumbing', priority: 'high' } };
    const { getByDisplayValue } = render(wrapWithQuery(<CreateTaskPage />));
    await waitFor(() => {
      expect(getByDisplayValue('Install plumbing')).toBeTruthy();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('EditTaskPage — voice task entry', () => {
  beforeEach(resetVoiceState);

  it('renders the Voice button', async () => {
    const { getByLabelText } = render(wrapWithQuery(<EditTaskPage />));
    // Wait for the existing task to load
    await waitFor(() => getByLabelText('Start voice recording'));
    expect(getByLabelText('Start voice recording')).toBeTruthy();
  });

  it('calls startRecording when Voice button is tapped', async () => {
    const { getByLabelText } = render(wrapWithQuery(<EditTaskPage />));
    await waitFor(() => getByLabelText('Start voice recording'));

    await act(async () => {
      fireEvent.press(getByLabelText('Start voice recording'));
    });
    expect(mockStartRecording).toHaveBeenCalledTimes(1);
  });

  it('pre-fills the form with merged values once voice is done', async () => {
    // Update voiceStateMock to 'done' AFTER the page has rendered + loaded the task
    const { getByLabelText, rerender, getByDisplayValue } = render(wrapWithQuery(<EditTaskPage />));
    await waitFor(() => getByLabelText('Start voice recording'));

    // Simulate voice draft arriving
    mockVoiceControl.state = { phase: 'done', draft: { title: 'Updated by voice', priority: 'urgent' } };
    rerender(wrapWithQuery(<EditTaskPage />));

    await waitFor(() => {
      expect(getByDisplayValue('Updated by voice')).toBeTruthy();
    });
  });
});
