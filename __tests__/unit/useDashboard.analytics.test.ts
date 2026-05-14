/**
 * Analytics instrumentation tests for useDashboard.
 *
 * Verifies that the correct IAnalyticsService events are emitted for
 * FAB (quick actions) and individual quick action selection.
 *
 * AC-1: Events use namespaced names from the design taxonomy.
 * AC-2: FAB open/dismiss/select events are all tracked.
 * AC-6: Unit tests verify event emission.
 */

import { renderHook, act } from '@testing-library/react-native';

// ── Module mocks (hoisted) ────────────────────────────────────────────────────

const mockTrack = jest.fn();

jest.mock('../../src/hooks/useAnalytics', () => ({
  useAnalytics: () => ({ track: mockTrack, screen: jest.fn() }),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(),
  CommonActions: { navigate: jest.fn((p: unknown) => p) },
}));

jest.mock('../../src/features/dashboard/hooks/useProjectsOverview', () => ({
  useProjectsOverview: jest.fn(),
}));

jest.mock('../../src/infrastructure/ocr/MobileOcrAdapter', () => ({
  MobileOcrAdapter: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../../src/features/invoices/application/InvoiceNormalizer', () => ({
  InvoiceNormalizer: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../../src/infrastructure/files/PdfThumbnailConverter', () => ({
  PdfThumbnailConverter: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../../src/features/quotations/infrastructure/ai/LlmQuotationParser', () => ({
  LlmQuotationParser: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../../src/features/receipts/infrastructure/LlmReceiptParser', () => ({
  LlmReceiptParser: jest.fn().mockImplementation(() => ({})),
}));

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { useNavigation } from '@react-navigation/native';
import { useProjectsOverview } from '../../src/features/dashboard/hooks/useProjectsOverview';
import { useDashboard } from '../../src/features/dashboard/hooks/useDashboard';

const mockUseNavigation = useNavigation as jest.MockedFunction<typeof useNavigation>;
const mockUseProjectsOverview = useProjectsOverview as jest.MockedFunction<typeof useProjectsOverview>;

// ── Tests ────────────────────────────────────────────────────────────────────

describe('useDashboard — analytics instrumentation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseNavigation.mockReturnValue({ dispatch: jest.fn() } as any);
    mockUseProjectsOverview.mockReturnValue({ data: [], isLoading: false, error: null } as any);
  });

  it('openQuickActions emits dashboard.quick_actions_opened', () => {
    const { result } = renderHook(() => useDashboard());
    act(() => result.current.openQuickActions());
    expect(mockTrack).toHaveBeenCalledWith('dashboard.quick_actions_opened');
  });

  it('closeQuickActions emits dashboard.quick_actions_dismissed', () => {
    const { result } = renderHook(() => useDashboard());
    act(() => result.current.closeQuickActions());
    expect(mockTrack).toHaveBeenCalledWith('dashboard.quick_actions_dismissed');
  });

  it('handleQuickAction emits dashboard.quick_action_selected with action_id and action_title', () => {
    const { result } = renderHook(() => useDashboard());
    act(() => result.current.handleQuickAction('1'));
    expect(mockTrack).toHaveBeenCalledWith(
      'dashboard.quick_action_selected',
      { action_id: '1', action_title: 'Snap Receipt' },
    );
  });

  it('handleQuickAction for "Add Invoice" includes correct title', () => {
    const { result } = renderHook(() => useDashboard());
    act(() => result.current.handleQuickAction('2'));
    expect(mockTrack).toHaveBeenCalledWith(
      'dashboard.quick_action_selected',
      { action_id: '2', action_title: 'Add Invoice' },
    );
  });

  it('handleQuickAction for "Ad Hoc Task" includes correct title', () => {
    const { result } = renderHook(() => useDashboard());
    act(() => result.current.handleQuickAction('5'));
    expect(mockTrack).toHaveBeenCalledWith(
      'dashboard.quick_action_selected',
      { action_id: '5', action_title: 'Ad Hoc Task' },
    );
  });

  it('handleQuickAction does NOT emit quick_actions_opened (separate concern)', () => {
    const { result } = renderHook(() => useDashboard());
    mockTrack.mockClear();
    act(() => result.current.handleQuickAction('1'));
    const openedCalls = mockTrack.mock.calls.filter(
      ([e]) => e === 'dashboard.quick_actions_opened',
    );
    expect(openedCalls).toHaveLength(0);
  });
});
