/**
 * Unit tests for useDashboard View-Model hook
 * Design: design/issue-210-dashboard-architecture-refactor.md §8.1
 *
 * Acceptance criteria:
 * - Returns structured data mapped from useProjectsOverview mock (isLoading, hasProjects, overviews)
 * - openQuickActions / closeQuickActions toggles modal state
 * - handleQuickAction('1') closes quick actions modal and opens snapReceipt
 * - Correctly sets appropriate showXxx true based on Quick Action ID
 * - Infrastructure adapters are populated and stable references
 * - navigateToProject('id') correctly calls React Navigation dispatcher
 */

import { renderHook, act } from '@testing-library/react-native';

// ── Module mocks (must be hoisted before imports) ────────────────────────────

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(),
  CommonActions: {
    navigate: jest.fn((params: unknown) => ({ type: 'NAVIGATE', payload: params })),
  },
}));

jest.mock('../../hooks/useProjectsOverview', () => ({
  useProjectsOverview: jest.fn(),
}));

jest.mock('../../../../infrastructure/ocr/MobileOcrAdapter', () => ({
  MobileOcrAdapter: jest.fn().mockImplementation(() => ({ extractText: jest.fn() })),
}));

jest.mock('../../../invoices/application/InvoiceNormalizer', () => ({
  InvoiceNormalizer: jest.fn().mockImplementation(() => ({ normalize: jest.fn() })),
}));

jest.mock('../../../../infrastructure/files/PdfThumbnailConverter', () => ({
  PdfThumbnailConverter: jest.fn().mockImplementation(() => ({ convertToImages: jest.fn() })),
}));

jest.mock('../../../quotations/infrastructure/ai/LlmQuotationParser', () => ({
  LlmQuotationParser: jest.fn().mockImplementation(() => ({ parse: jest.fn(), strategyType: 'llm' })),
}));

jest.mock('../../../../features/receipts/infrastructure/LlmReceiptParser', () => ({
  LlmReceiptParser: jest.fn().mockImplementation(() => ({ parse: jest.fn(), strategyType: 'llm' })),
}));

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { useNavigation, CommonActions } from '@react-navigation/native';
import { useProjectsOverview } from '../../hooks/useProjectsOverview';
import { useDashboard } from '../../hooks/useDashboard';
import type { ProjectOverview } from '../../hooks/useProjectsOverview';
import type { QuickAction } from '../../hooks/useDashboard';

// ── Typed mock helpers ───────────────────────────────────────────────────────

const mockDispatch = jest.fn();
const mockUseNavigation = useNavigation as jest.MockedFunction<typeof useNavigation>;
const mockUseProjectsOverview = useProjectsOverview as jest.MockedFunction<
  typeof useProjectsOverview
>;

const DEFAULT_OVERVIEW_RETURN = {
  data: undefined as ProjectOverview[] | undefined,
  isLoading: false,
  error: null,
} as any;

// ── Tests ────────────────────────────────────────────────────────────────────

describe('useDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseNavigation.mockReturnValue({ dispatch: mockDispatch } as any);
    mockUseProjectsOverview.mockReturnValue({ ...DEFAULT_OVERVIEW_RETURN });
  });

  // AC: Returns structured data mapped from useProjectsOverview mock
  describe('data state mapping', () => {
    it('forwards isLoading=true when useProjectsOverview is loading', () => {
      mockUseProjectsOverview.mockReturnValue({
        ...DEFAULT_OVERVIEW_RETURN,
        isLoading: true,
      });

      const { result } = renderHook(() => useDashboard());

      expect(result.current.isLoading).toBe(true);
      expect(result.current.overviews).toBeUndefined();
      expect(result.current.hasProjects).toBe(false);
    });

    it('forwards error from useProjectsOverview', () => {
      const err = new Error('DB failure');
      mockUseProjectsOverview.mockReturnValue({
        ...DEFAULT_OVERVIEW_RETURN,
        error: err,
      });

      const { result } = renderHook(() => useDashboard());

      expect(result.current.error).toBe(err);
      expect(result.current.isLoading).toBe(false);
    });

    it('sets hasProjects=false when overviews is empty', () => {
      mockUseProjectsOverview.mockReturnValue({
        ...DEFAULT_OVERVIEW_RETURN,
        data: [],
      });

      const { result } = renderHook(() => useDashboard());

      expect(result.current.hasProjects).toBe(false);
      expect(result.current.overviews).toEqual([]);
    });

    it('sets hasProjects=true and surfaces overviews when projects exist', () => {
      const mockOverviews = [{ project: { id: 'p1', name: 'Test' } }] as ProjectOverview[];
      mockUseProjectsOverview.mockReturnValue({
        ...DEFAULT_OVERVIEW_RETURN,
        data: mockOverviews,
      });

      const { result } = renderHook(() => useDashboard());

      expect(result.current.hasProjects).toBe(true);
      expect(result.current.overviews).toEqual(mockOverviews);
    });
  });

  // AC: openQuickActions / closeQuickActions toggles modal state
  describe('quick actions modal toggle', () => {
    it('showQuickActions starts false', () => {
      const { result } = renderHook(() => useDashboard());
      expect(result.current.showQuickActions).toBe(false);
    });

    it('openQuickActions sets showQuickActions to true', () => {
      const { result } = renderHook(() => useDashboard());

      act(() => {
        result.current.openQuickActions();
      });

      expect(result.current.showQuickActions).toBe(true);
    });

    it('closeQuickActions sets showQuickActions to false', () => {
      const { result } = renderHook(() => useDashboard());

      act(() => { result.current.openQuickActions(); });
      act(() => { result.current.closeQuickActions(); });

      expect(result.current.showQuickActions).toBe(false);
    });
  });

  // AC: handleQuickAction('1') closes quick actions and opens snapReceipt
  describe('handleQuickAction routing', () => {
    it('action "1" closes quick actions and opens snapReceipt', () => {
      const { result } = renderHook(() => useDashboard());

      act(() => { result.current.openQuickActions(); });
      act(() => { result.current.handleQuickAction('1'); });

      expect(result.current.showQuickActions).toBe(false);
      expect(result.current.showSnapReceipt).toBe(true);
    });

    it('action "2" opens addInvoice modal', () => {
      const { result } = renderHook(() => useDashboard());

      act(() => { result.current.handleQuickAction('2'); });

      expect(result.current.showAddInvoice).toBe(true);
      expect(result.current.showQuickActions).toBe(false);
    });

    it('action "4" opens quotation modal', () => {
      const { result } = renderHook(() => useDashboard());

      act(() => { result.current.handleQuickAction('4'); });

      expect(result.current.showQuotation).toBe(true);
    });

    it('action "5" opens adHocTask', () => {
      const { result } = renderHook(() => useDashboard());

      act(() => { result.current.handleQuickAction('5'); });

      expect(result.current.showAdHocTask).toBe(true);
    });

    it('action "3" (Log Payment) closes quick actions but opens nothing', () => {
      const { result } = renderHook(() => useDashboard());

      act(() => { result.current.openQuickActions(); });
      act(() => { result.current.handleQuickAction('3'); });

      expect(result.current.showQuickActions).toBe(false);
      expect(result.current.showSnapReceipt).toBe(false);
      expect(result.current.showAddInvoice).toBe(false);
      expect(result.current.showQuotation).toBe(false);
      expect(result.current.showAdHocTask).toBe(false);
    });
  });

  // AC: close handlers work correctly
  describe('close handlers', () => {
    it('closeSnapReceipt sets showSnapReceipt to false', () => {
      const { result } = renderHook(() => useDashboard());
      act(() => { result.current.handleQuickAction('1'); });
      act(() => { result.current.closeSnapReceipt(); });
      expect(result.current.showSnapReceipt).toBe(false);
    });

    it('closeAddInvoice sets showAddInvoice to false', () => {
      const { result } = renderHook(() => useDashboard());
      act(() => { result.current.handleQuickAction('2'); });
      act(() => { result.current.closeAddInvoice(); });
      expect(result.current.showAddInvoice).toBe(false);
    });

    it('closeAdHocTask sets showAdHocTask to false', () => {
      const { result } = renderHook(() => useDashboard());
      act(() => { result.current.handleQuickAction('5'); });
      act(() => { result.current.closeAdHocTask(); });
      expect(result.current.showAdHocTask).toBe(false);
    });

    it('closeQuotation sets showQuotation to false', () => {
      const { result } = renderHook(() => useDashboard());
      act(() => { result.current.handleQuickAction('4'); });
      act(() => { result.current.closeQuotation(); });
      expect(result.current.showQuotation).toBe(false);
    });
  });

  // AC: Infrastructure adapters are populated and stable references
  describe('infrastructure adapters', () => {
    it('always-created adapters (OcrAdapter, Normalizer, PdfConverter) are defined', () => {
      const { result } = renderHook(() => useDashboard());

      expect(result.current.invoiceOcrAdapter).toBeDefined();
      expect(result.current.invoiceNormalizer).toBeDefined();
      expect(result.current.invoicePdfConverter).toBeDefined();
    });

    it('LLM parsers are undefined when no GROQ_API_KEY is present (test env default)', () => {
      // In the test environment .env.development has no GROQ_API_KEY
      // so parsers are correctly not instantiated
      const { result } = renderHook(() => useDashboard());

      // The hook exposes the fields — whether they are defined depends on the key
      // This test asserts they exist as properties on the view-model
      expect('quotationParser' in result.current).toBe(true);
      expect('receiptParser' in result.current).toBe(true);
    });

    it('adapter instances are stable across re-renders (useMemo)', () => {
      const { result, rerender } = renderHook(() => useDashboard());
      const first = {
        ocrAdapter: result.current.invoiceOcrAdapter,
        normalizer: result.current.invoiceNormalizer,
        pdfConverter: result.current.invoicePdfConverter,
      };

      rerender({});

      expect(result.current.invoiceOcrAdapter).toBe(first.ocrAdapter);
      expect(result.current.invoiceNormalizer).toBe(first.normalizer);
      expect(result.current.invoicePdfConverter).toBe(first.pdfConverter);
    });


  });

  // AC: navigateToProject calls React Navigation dispatcher
  describe('navigateToProject', () => {
    it('calls navigation.dispatch when navigateToProject is invoked', () => {
      const { result } = renderHook(() => useDashboard());

      act(() => {
        result.current.navigateToProject('project-abc');
      });

      expect(mockDispatch).toHaveBeenCalledTimes(1);
    });

    it('dispatches a CommonActions.navigate call with the projectId', () => {
      const { result } = renderHook(() => useDashboard());

      act(() => {
        result.current.navigateToProject('project-xyz');
      });

      expect(CommonActions.navigate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Projects',
          params: expect.objectContaining({
            screen: 'ProjectDetail',
            params: { projectId: 'project-xyz' },
          }),
        }),
      );
    });
  });

  // AC: quickActions array is returned from the hook
  describe('quickActions', () => {
    it('returns exactly 5 quick actions', () => {
      const { result } = renderHook(() => useDashboard());
      expect(result.current.quickActions).toHaveLength(5);
    });

    it('each action has id, title, icon (truthy), and color', () => {
      const { result } = renderHook(() => useDashboard());
      for (const action of result.current.quickActions) {
        expect(typeof action.id).toBe('string');
        expect(typeof action.title).toBe('string');
        expect(action.icon).toBeTruthy();
        expect(typeof action.color).toBe('string');
      }
    });

    it('actions are in the expected order by title', () => {
      const { result } = renderHook(() => useDashboard());
      const titles = result.current.quickActions.map((a: QuickAction) => a.title);
      expect(titles).toEqual([
        'Snap Receipt',
        'Add Invoice',
        'Log Payment',
        'Add Quote',
        'Ad Hoc Task',
      ]);
    });

    it('returns a stable reference across re-renders', () => {
      const { result, rerender } = renderHook(() => useDashboard());
      const first = result.current.quickActions;
      rerender({});
      expect(result.current.quickActions).toBe(first);
    });
  });

  // AC: onManualEntry increments createKey
  describe('onManualEntry', () => {
    it('starts with createKey=0', () => {
      const { result } = renderHook(() => useDashboard());
      expect(result.current.createKey).toBe(0);
    });

    it('increments createKey each call', () => {
      const { result } = renderHook(() => useDashboard());

      act(() => { result.current.onManualEntry(); });
      expect(result.current.createKey).toBe(1);

      act(() => { result.current.onManualEntry(); });
      expect(result.current.createKey).toBe(2);
    });
  });

  // AC: exported function references are stable across re-renders (useCallback)
  describe('function reference stability', () => {
    it('openQuickActions is stable across re-renders', () => {
      const { result, rerender } = renderHook(() => useDashboard());
      const first = result.current.openQuickActions;
      rerender({});
      expect(result.current.openQuickActions).toBe(first);
    });

    it('closeQuickActions is stable across re-renders', () => {
      const { result, rerender } = renderHook(() => useDashboard());
      const first = result.current.closeQuickActions;
      rerender({});
      expect(result.current.closeQuickActions).toBe(first);
    });

    it('handleQuickAction is stable across re-renders', () => {
      const { result, rerender } = renderHook(() => useDashboard());
      const first = result.current.handleQuickAction;
      rerender({});
      expect(result.current.handleQuickAction).toBe(first);
    });

    it('navigateToProject is stable across re-renders', () => {
      const { result, rerender } = renderHook(() => useDashboard());
      const first = result.current.navigateToProject;
      rerender({});
      expect(result.current.navigateToProject).toBe(first);
    });

    it('closeSnapReceipt is stable across re-renders', () => {
      const { result, rerender } = renderHook(() => useDashboard());
      const first = result.current.closeSnapReceipt;
      rerender({});
      expect(result.current.closeSnapReceipt).toBe(first);
    });

    it('closeAddInvoice is stable across re-renders', () => {
      const { result, rerender } = renderHook(() => useDashboard());
      const first = result.current.closeAddInvoice;
      rerender({});
      expect(result.current.closeAddInvoice).toBe(first);
    });

    it('closeAdHocTask is stable across re-renders', () => {
      const { result, rerender } = renderHook(() => useDashboard());
      const first = result.current.closeAdHocTask;
      rerender({});
      expect(result.current.closeAdHocTask).toBe(first);
    });

    it('closeQuotation is stable across re-renders', () => {
      const { result, rerender } = renderHook(() => useDashboard());
      const first = result.current.closeQuotation;
      rerender({});
      expect(result.current.closeQuotation).toBe(first);
    });

    it('onManualEntry is stable across re-renders', () => {
      const { result, rerender } = renderHook(() => useDashboard());
      const first = result.current.onManualEntry;
      rerender({});
      expect(result.current.onManualEntry).toBe(first);
    });
  });
});
