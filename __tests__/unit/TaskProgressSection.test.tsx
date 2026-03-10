/**
 * Unit tests for TaskProgressSection (Issue #133).
 *
 * Run: npx jest __tests__/unit/TaskProgressSection.test.tsx
 */
import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import { TaskProgressSection, formatRelativeTime } from '../../src/components/tasks/TaskProgressSection';
import { ProgressLog } from '../../src/domain/entities/ProgressLog';

// ── Stubs ──────────────────────────────────────────────────────────────────────

jest.mock('nativewind', () => ({
  cssInterop: jest.fn(),
  useColorScheme: () => ({ colorScheme: 'light' }),
}));

jest.mock('lucide-react-native', () => ({
  Plus: 'Plus',
  MoreVertical: 'MoreVertical',
  Edit2: 'Edit2',
  Trash2: 'Trash2',
}));

// ─────────────────────────────────────────────────────────────────────────────

const makeLog = (overrides: Partial<ProgressLog> = {}): ProgressLog => ({
  id: 'log-1',
  taskId: 'task-1',
  logType: 'info',
  createdAt: Date.now() - 30_000, // 30 s ago → "just now"
  ...overrides,
});

// ── Badge mapping ─────────────────────────────────────────────────────────────

describe('LogTypeBadge — all 7 types render correct label', () => {
  const cases: Array<[ProgressLog['logType'], string]> = [
    ['info',       'Info'],
    ['general',    'General'],
    ['inspection', 'Inspection'],
    ['delay',      'Delay'],
    ['issue',      'Issue'],
    ['completion', 'Completion'],
    ['other',      'Other'],
  ];

  test.each(cases)('logType "%s" renders "%s"', (logType, label) => {
    const { getByText } = render(
      <TaskProgressSection progressLogs={[makeLog({ id: logType, logType })]} />,
    );
    expect(getByText(label)).toBeTruthy();
  });
});

// ── Section behaviour ─────────────────────────────────────────────────────────

describe('TaskProgressSection', () => {
  it('calls onAddLog when "+ Add Log" is pressed', () => {
    const onAddLog = jest.fn();
    const { getByLabelText } = render(
      <TaskProgressSection progressLogs={[]} onAddLog={onAddLog} />,
    );
    fireEvent.press(getByLabelText('Add progress log'));
    expect(onAddLog).toHaveBeenCalledTimes(1);
  });

  it('shows empty-state message when no logs provided', () => {
    const { getByText } = render(<TaskProgressSection progressLogs={[]} />);
    expect(getByText('No progress logs yet')).toBeTruthy();
  });

  it('shows relative time "just now" for a freshly created log', () => {
    const { getByText } = render(
      <TaskProgressSection progressLogs={[makeLog({ createdAt: Date.now() - 5_000 })]} />,
    );
    expect(getByText('just now')).toBeTruthy();
  });

  it('calls onEditLog when Edit action is tapped', async () => {
    const onEditLog = jest.fn();
    const log = makeLog();
    const { getByTestId } = render(
      <TaskProgressSection progressLogs={[log]} onEditLog={onEditLog} />,
    );
    await act(async () => { fireEvent.press(getByTestId(`log-options-${log.id}`)); });
    fireEvent.press(getByTestId(`log-edit-${log.id}`));
    expect(onEditLog).toHaveBeenCalledWith(log);
  });

  it('shows Alert.alert with confirmation when Delete is tapped', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const log = makeLog();
    const { getByTestId } = render(
      <TaskProgressSection progressLogs={[log]} onDeleteLog={jest.fn()} />,
    );
    await act(async () => { fireEvent.press(getByTestId(`log-options-${log.id}`)); });
    fireEvent.press(getByTestId(`log-delete-${log.id}`));
    expect(alertSpy).toHaveBeenCalledWith(
      'Delete Log',
      expect.any(String),
      expect.any(Array),
    );
  });

  it('calls onDeleteLog with logId when deletion is confirmed', async () => {
    const onDeleteLog = jest.fn();
    const log = makeLog();
    const alertSpy = jest
      .spyOn(Alert, 'alert')
      .mockImplementation((_title, _msg, buttons) => {
        const destructive = (buttons as any[]).find((b) => b.style === 'destructive');
        destructive?.onPress?.();
      });
    const { getByTestId } = render(
      <TaskProgressSection progressLogs={[log]} onDeleteLog={onDeleteLog} />,
    );
    await act(async () => { fireEvent.press(getByTestId(`log-options-${log.id}`)); });
    fireEvent.press(getByTestId(`log-delete-${log.id}`));
    expect(onDeleteLog).toHaveBeenCalledWith(log.id);
    alertSpy.mockRestore();
  });
});

// ── formatRelativeTime ────────────────────────────────────────────────────────

describe('formatRelativeTime', () => {
  it('returns "just now" for < 60 s', () => {
    expect(formatRelativeTime(Date.now() - 30_000)).toBe('just now');
  });
  it('returns "X min ago" for < 1 h', () => {
    expect(formatRelativeTime(Date.now() - 5 * 60_000)).toBe('5 min ago');
  });
  it('returns "X hours ago" for < 24 h', () => {
    expect(formatRelativeTime(Date.now() - 3 * 3_600_000)).toBe('3 hours ago');
  });
  it('returns "X days ago" for < 7 d', () => {
    expect(formatRelativeTime(Date.now() - 3 * 86_400_000)).toBe('3 days ago');
  });
});
