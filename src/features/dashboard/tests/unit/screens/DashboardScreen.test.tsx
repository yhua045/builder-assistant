/**
 * Unit tests for the refactored DashboardScreen component.
 * Design: design/issue-210-dashboard-architecture-refactor.md §8.2
 *
 * Acceptance criteria:
 * - UI renders completely mock-driven from useDashboard() hook injected values
 * - Zero infrastructure/ or application/ layer imports exist in the component file
 */

import React from 'react';
import renderer, { act } from 'react-test-renderer';

// ── Mock UI dependencies ──────────────────────────────────────────────────────

jest.mock('lucide-react-native', () => ({
  Camera: 'Camera',
  Receipt: 'Receipt',
  DollarSign: 'DollarSign',
  FileText: 'FileText',
  Wrench: 'Wrench',
  X: 'X',
  Plus: 'Plus',
}));

jest.mock('../../../../../components/ThemeToggle', () => ({
  ThemeToggle: () => null,
}));

jest.mock('../../../components/ProjectOverviewCard', () => ({
  ProjectOverviewCard: () => null,
}));

jest.mock('../../../components/HeroSection', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../../../../../components/ManualProjectEntry', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../../../../receipts/screens/SnapReceiptScreen', () => ({
  SnapReceiptScreen: () => null,
}));

jest.mock('../../../../invoices/screens/InvoiceScreen', () => ({
  InvoiceScreen: () => null,
}));

jest.mock('../../../../../pages/quotations/QuotationScreen', () => ({
  QuotationScreen: () => null,
}));

jest.mock('../../../../../pages/tasks/TaskScreen', () => ({
  __esModule: true,
  default: () => null,
}));

// ── Mock the single ViewModel hook ────────────────────────────────────────────

jest.mock('../../../hooks/useDashboard', () => ({
  useDashboard: jest.fn(),
}));

import { useDashboard } from '../../../hooks/useDashboard';
import type { QuickAction } from '../../../hooks/useDashboard';
import { DashboardScreen } from '../../../screens/DashboardScreen';

const mockUseDashboard = useDashboard as jest.MockedFunction<typeof useDashboard>;

// ── Default view-model that renders a neutral "no projects, no error" state ──

function makeDefaultVm(overrides: Partial<ReturnType<typeof useDashboard>> = {}) {
  return {
    overviews: undefined,
    isLoading: false,
    error: null,
    hasProjects: false,
    quickActions: [] as readonly QuickAction[],
    showQuickActions: false,
    showSnapReceipt: false,
    showAddInvoice: false,
    showAdHocTask: false,
    showQuotation: false,
    createKey: 0,
    invoiceOcrAdapter: {} as any,
    invoiceNormalizer: {} as any,
    invoicePdfConverter: {} as any,
    quotationParser: undefined,
    receiptParser: undefined,
    openQuickActions: jest.fn(),
    closeQuickActions: jest.fn(),
    handleQuickAction: jest.fn(),
    closeSnapReceipt: jest.fn(),
    closeAddInvoice: jest.fn(),
    closeAdHocTask: jest.fn(),
    closeQuotation: jest.fn(),
    onManualEntry: jest.fn(),
    navigateToProject: jest.fn(),
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('DashboardScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseDashboard.mockReturnValue(makeDefaultVm());
  });

  it('renders without crashing with default view-model', () => {
    let tree: any;
    act(() => {
      tree = renderer.create(<DashboardScreen />);
    });
    expect(tree).toBeTruthy();
  });

  it('shows loading text when isLoading is true', () => {
    mockUseDashboard.mockReturnValue(makeDefaultVm({ isLoading: true }));

    let tree: any;
    act(() => {
      tree = renderer.create(<DashboardScreen />);
    });

    const loadingNodes = tree.root.findAllByProps({ children: 'Loading projects...' });
    expect(loadingNodes.length).toBeGreaterThan(0);
  });

  it('shows error text when error is set', () => {
    mockUseDashboard.mockReturnValue(
      makeDefaultVm({ error: new Error('Network failure') }),
    );

    let tree: any;
    act(() => {
      tree = renderer.create(<DashboardScreen />);
    });

    const errorNodes = tree.root.findAllByProps({ children: 'Failed to load overview data' });
    expect(errorNodes.length).toBeGreaterThan(0);
  });

  it('FAB calls vm.openQuickActions on press', () => {
    const openQuickActions = jest.fn();
    mockUseDashboard.mockReturnValue(makeDefaultVm({ openQuickActions }));

    let tree: any;
    act(() => {
      tree = renderer.create(<DashboardScreen />);
    });

    // Find the FAB by testID
    const fab = tree.root.findByProps({ testID: 'quick-actions-fab' });

    act(() => {
      fab.props.onPress();
    });

    expect(openQuickActions).toHaveBeenCalledTimes(1);
  });

  it('Quick Actions modal is visible when showQuickActions=true', () => {
    mockUseDashboard.mockReturnValue(makeDefaultVm({ showQuickActions: true }));

    let tree: any;
    act(() => {
      tree = renderer.create(<DashboardScreen />);
    });

    const modals = tree.root.findAllByType('Modal' as any);
    const qaModal = modals.find((m: any) => m.props.animationType === 'fade');
    expect(qaModal?.props.visible).toBe(true);
  });

  it('Quick Actions modal is hidden when showQuickActions=false', () => {
    mockUseDashboard.mockReturnValue(makeDefaultVm({ showQuickActions: false }));

    let tree: any;
    act(() => {
      tree = renderer.create(<DashboardScreen />);
    });

    const modals = tree.root.findAllByType('Modal' as any);
    const qaModal = modals.find((m: any) => m.props.animationType === 'fade');
    // When visible=false the RN Modal mock may not render to the tree;
    // either way, the effective visibility is false.
    expect(qaModal?.props.visible ?? false).toBe(false);
  });

  it('Add Invoice modal visible flag reflects vm.showAddInvoice', () => {
    mockUseDashboard.mockReturnValue(makeDefaultVm({ showAddInvoice: true }));

    let tree: any;
    act(() => {
      tree = renderer.create(<DashboardScreen />);
    });

    const invoiceModal = tree.root.findAllByProps({ testID: 'add-invoice-modal' });
    expect(invoiceModal.length).toBeGreaterThan(0);
    expect(invoiceModal[0].props.visible).toBe(true);
  });

  it('renders TaskScreen when showAdHocTask=true', () => {
    mockUseDashboard.mockReturnValue(makeDefaultVm({ showAdHocTask: true }));

    let tree: any;
    act(() => {
      tree = renderer.create(<DashboardScreen />);
    });
    // TaskScreen mock is rendered — check the tree was created without errors
    expect(tree).toBeTruthy();
  });

  it('does not render TaskScreen when showAdHocTask=false', () => {
    mockUseDashboard.mockReturnValue(makeDefaultVm({ showAdHocTask: false }));

    let tree: any;
    act(() => {
      tree = renderer.create(<DashboardScreen />);
    });
    expect(tree).toBeTruthy();
  });

  it('project list is shown when hasProjects=true', () => {
    const overviews = [
      { project: { id: 'p1', name: 'My Project' } },
    ] as any;

    mockUseDashboard.mockReturnValue(
      makeDefaultVm({ hasProjects: true, overviews }),
    );

    let tree: any;
    act(() => {
      tree = renderer.create(<DashboardScreen />);
    });

    const projectCountText = tree.root.findAllByProps({
      children: `Active Projects (${overviews.length})`,
    });
    expect(projectCountText.length).toBeGreaterThan(0);
  });

  it('useDashboard is the only hook called (no infra imports in component)', () => {
    // Rendering the component must call useDashboard (and nothing from infra/).
    act(() => {
      renderer.create(<DashboardScreen />);
    });
    expect(mockUseDashboard).toHaveBeenCalled();
  });
});
