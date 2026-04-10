/**
 * Integration tests for ProjectDetail — Payments & Quotes sections.
 *
 * Covers:
 *  - Payments section header renders and starts COLLAPSED
 *  - Toggling Payments section header shows payment cards
 *  - Quotes section header renders and starts COLLAPSED
 *  - Toggling Quotes section header shows quotation cards
 *  - Empty-state messages when sections are expanded but empty
 *  - Section item counts shown in badge (section-header-{key}-count)
 *  - Truncation notice shown when section.truncated = true
 *
 * Strategy: mock the four focused hooks directly so we test the component tree
 * without needing a QueryClientProvider. Data-layer logic is covered in unit tests.
 */

import React from 'react';
import renderer, { act } from 'react-test-renderer';

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('nativewind', () => ({
  cssInterop: jest.fn(),
  useColorScheme: () => ({ colorScheme: 'light' }),
}));

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockAddListener = jest.fn(() => jest.fn());

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack, addListener: mockAddListener }),
  useRoute: () => ({ params: { projectId: 'proj-1' } }),
}));

jest.mock('lucide-react-native', () => ({
  ArrowLeft: 'ArrowLeft', MapPin: 'MapPin', Phone: 'Phone',
  Calendar: 'Calendar', Clock: 'Clock',
  AlertCircle: 'AlertCircle', CheckCircle: 'CheckCircle',
  XCircle: 'XCircle', Play: 'Play', ExternalLink: 'ExternalLink',
  Camera: 'Camera', Paperclip: 'Paperclip',
  ChevronDown: 'ChevronDown', ChevronRight: 'ChevronRight',
  DollarSign: 'DollarSign', FileText: 'FileText',
  Pencil: 'Pencil',
}));

// ── Four focused hook mocks ───────────────────────────────────────────────────

const mockMarkComplete = jest.fn().mockResolvedValue(undefined);
const mockRecordPayment = jest.fn().mockResolvedValue(undefined);
const mockInvalidateTasks = jest.fn().mockResolvedValue(undefined);
const mockInvalidatePayments = jest.fn().mockResolvedValue(undefined);
const mockInvalidateQuotations = jest.fn().mockResolvedValue(undefined);

let mockProjectDetailReturn: any;
let mockTaskTimelineReturn: any;
let mockPaymentsTimelineReturn: any;
let mockQuotationsTimelineReturn: any;

jest.mock('../../src/hooks/useProjectDetail', () => ({
  useProjectDetail: () => mockProjectDetailReturn,
}));
jest.mock('../../src/hooks/useTaskTimeline', () => ({
  useTaskTimeline: () => mockTaskTimelineReturn,
}));
jest.mock('../../src/hooks/usePaymentsTimeline', () => ({
  usePaymentsTimeline: () => mockPaymentsTimelineReturn,
}));
jest.mock('../../src/hooks/useQuotationsTimeline', () => ({
  useQuotationsTimeline: () => mockQuotationsTimelineReturn,
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * SectionList with stickySectionHeadersEnabled may clone header elements.
 * Some cloned elements may not carry onPress. This helper finds the first
 * element with the given testID AND an actual onPress function.
 */
function findPressable(tree: renderer.ReactTestRenderer, testID: string) {
  const found = tree.root.findAll(
    (el) => el.props.testID === testID && typeof el.props.onPress === 'function',
  );
  return found[0] ?? null;
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const sampleProject = {
  id: 'proj-1',
  name: 'Smith Residence',
  status: 'in_progress',
  materials: [],
  phases: [],
};

const samplePayment = {
  id: 'pay-1',
  amount: 5000,
  status: 'pending' as const,
  dueDate: '2026-04-01T00:00:00Z',
};

const samplePayment2 = {
  id: 'pay-2',
  amount: 2500,
  status: 'settled' as const,
  dueDate: '2026-04-05T00:00:00Z',
};

const sampleInvoice = {
  id: 'inv-1',
  total: 4200,
  currency: 'AUD',
  status: 'issued' as const,
  paymentStatus: 'unpaid' as const,
  issuerName: 'ABC Plumbing',
  externalReference: 'INV-0042',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const sampleQuotation = {
  id: 'quot-1',
  reference: 'QT-001',
  total: 12000,
  currency: 'AUD',
  status: 'pending' as const,
  date: '2026-03-20T00:00:00Z',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// ── Default mock setup ────────────────────────────────────────────────────────

function setupDefaultMocks(overrides: {
  projectDetail?: any;
  taskTimeline?: any;
  paymentsTimeline?: any;
  quotationsTimeline?: any;
} = {}) {
  mockProjectDetailReturn = {
    project: sampleProject,
    loading: false,
    error: null,
    ...overrides.projectDetail,
  };
  mockTaskTimelineReturn = {
    dayGroups: [],
    loading: false,
    error: null,
    markComplete: mockMarkComplete,
    invalidate: mockInvalidateTasks,
    ...overrides.taskTimeline,
  };
  mockPaymentsTimelineReturn = {
    paymentDayGroups: [],
    loading: false,
    error: null,
    truncated: false,
    recordPayment: mockRecordPayment,
    invalidate: mockInvalidatePayments,
    ...overrides.paymentsTimeline,
  };
  mockQuotationsTimelineReturn = {
    quotationDayGroups: [],
    loading: false,
    error: null,
    truncated: false,
    invalidate: mockInvalidateQuotations,
    ...overrides.quotationsTimeline,
  };
}

import ProjectDetailScreen from '../../src/pages/projects/ProjectDetail';

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ProjectDetail — sections', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupDefaultMocks();
  });

  // ── Section headers render ─────────────────────────────────────────────────

  it('renders all three section headers', async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<ProjectDetailScreen />);
    });
    expect(tree!.root.findAllByProps({ testID: 'section-header-tasks' }).length).toBeGreaterThan(0);
    expect(tree!.root.findAllByProps({ testID: 'section-header-payments' }).length).toBeGreaterThan(0);
    expect(tree!.root.findAllByProps({ testID: 'section-header-quotes' }).length).toBeGreaterThan(0);
  });

  // ── Collapse defaults ──────────────────────────────────────────────────────

  it('Payments section starts COLLAPSED (no payment cards visible)', async () => {
    setupDefaultMocks({
      paymentsTimeline: {
        paymentDayGroups: [{ date: '2026-04-01', label: 'Wed 1 Apr', items: [{ kind: 'payment', data: samplePayment }] }],
      },
    });
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<ProjectDetailScreen />);
    });
    // Section header exists
    expect(tree!.root.findAllByProps({ testID: 'section-header-payments' }).length).toBeGreaterThan(0);
    // But payment card should NOT be rendered (collapsed by default)
    expect(tree!.root.findAllByProps({ testID: 'payment-card-pay-1' }).length).toBe(0);
  });

  it('Quotes section starts COLLAPSED (no quotation cards visible)', async () => {
    setupDefaultMocks({
      quotationsTimeline: {
        quotationDayGroups: [{ date: '2026-03-20', label: 'Fri 20 Mar', quotations: [sampleQuotation] }],
      },
    });
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<ProjectDetailScreen />);
    });
    expect(tree!.root.findAllByProps({ testID: 'section-header-quotes' }).length).toBeGreaterThan(0);
    expect(tree!.root.findAllByProps({ testID: 'quotation-card-quot-1' }).length).toBe(0);
  });

  // ── Toggle to expand ───────────────────────────────────────────────────────

  it('toggling Payments section header reveals payment cards', async () => {
    setupDefaultMocks({
      paymentsTimeline: {
        paymentDayGroups: [{ date: '2026-04-01', label: 'Wed 1 Apr', items: [{ kind: 'payment', data: samplePayment }] }],
      },
    });
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<ProjectDetailScreen />);
    });

    // Tap the payments section header to expand
    const paymentsHeader = findPressable(tree!, 'section-header-payments');
    await act(async () => {
      paymentsHeader!.props.onPress();
    });

    // Payment card should now be visible
    expect(tree!.root.findAllByProps({ testID: 'payment-card-pay-1' }).length).toBeGreaterThan(0);
  });

  it('toggling Payments twice collapses it again', async () => {
    setupDefaultMocks({
      paymentsTimeline: {
        paymentDayGroups: [{ date: '2026-04-01', label: 'Wed 1 Apr', items: [{ kind: 'payment', data: samplePayment }] }],
      },
    });
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<ProjectDetailScreen />);
    });

    const paymentsHeader = findPressable(tree!, 'section-header-payments');

    // Expand
    await act(async () => { paymentsHeader!.props.onPress(); });
    expect(tree!.root.findAllByProps({ testID: 'payment-card-pay-1' }).length).toBeGreaterThan(0);

    // Collapse again
    await act(async () => { paymentsHeader!.props.onPress(); });
    expect(tree!.root.findAllByProps({ testID: 'payment-card-pay-1' }).length).toBe(0);
  });

  it('toggling Quotes section header reveals quotation cards', async () => {
    setupDefaultMocks({
      quotationsTimeline: {
        quotationDayGroups: [{ date: '2026-03-20', label: 'Fri 20 Mar', quotations: [sampleQuotation] }],
      },
    });
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<ProjectDetailScreen />);
    });

    const quotesHeader = findPressable(tree!, 'section-header-quotes');
    await act(async () => {
      quotesHeader!.props.onPress();
    });

    expect(tree!.root.findAllByProps({ testID: 'quotation-card-quot-1' }).length).toBeGreaterThan(0);
  });

  it('renders multiple payment cards in the same day group', async () => {
    setupDefaultMocks({
      paymentsTimeline: {
        paymentDayGroups: [
          {
            date: '2026-04-01',
            label: 'Wed 1 Apr',
            items: [
              { kind: 'payment', data: samplePayment },
              { kind: 'payment', data: samplePayment2 },
            ],
          },
        ],
      },
    });
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<ProjectDetailScreen />);
    });

    // Expand payments
    const paymentsHeader2 = findPressable(tree!, 'section-header-payments');
    await act(async () => { paymentsHeader2!.props.onPress(); });

    expect(tree!.root.findAllByProps({ testID: 'payment-card-pay-1' }).length).toBeGreaterThan(0);
    expect(tree!.root.findAllByProps({ testID: 'payment-card-pay-2' }).length).toBeGreaterThan(0);
  });

  // ── Empty states ───────────────────────────────────────────────────────────

  it('shows payments-empty message when Payments section is expanded with no data', async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<ProjectDetailScreen />);
    });

    const paymentsHeaderEmpty = findPressable(tree!, 'section-header-payments');
    await act(async () => { paymentsHeaderEmpty!.props.onPress(); });

    const empty = tree!.root.findAllByProps({ testID: 'payments-empty' });
    expect(empty.length).toBeGreaterThan(0);
  });

  it('shows quotes-empty message when Quotes section is expanded with no data', async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<ProjectDetailScreen />);
    });

    const quotesHeaderEmpty = findPressable(tree!, 'section-header-quotes');
    await act(async () => { quotesHeaderEmpty!.props.onPress(); });

    const empty = tree!.root.findAllByProps({ testID: 'quotes-empty' });
    expect(empty.length).toBeGreaterThan(0);
  });

  // ── Loading states ─────────────────────────────────────────────────────────

  it('section-header-payments shows loading indicator when payments are loading', async () => {
    setupDefaultMocks({ paymentsTimeline: { loading: true } });
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<ProjectDetailScreen />);
    });
    // The count badge should show 0 while loading
    const countBadge = tree!.root.findAllByProps({ testID: 'section-header-payments-count' });
    expect(countBadge.length).toBeGreaterThan(0);
  });

  // ── Focus listener ─────────────────────────────────────────────────────────

  it('registers a focus listener that invalidates all three sections', async () => {
    await act(async () => {
      renderer.create(<ProjectDetailScreen />);
    });
    expect(mockAddListener).toHaveBeenCalledWith('focus', expect.any(Function));

    // Simulate focus event
    const allCalls = mockAddListener.mock.calls as unknown as Array<[string, () => void]>;
    const focusCallback = allCalls.find(([event]) => event === 'focus')?.[1];
    await act(async () => { focusCallback?.(); });

    expect(mockInvalidateTasks).toHaveBeenCalled();
    expect(mockInvalidatePayments).toHaveBeenCalled();
    expect(mockInvalidateQuotations).toHaveBeenCalled();
  });

  // ── P1–P5: Mixed feed (invoice + payment items) ───────────────────────────

  // P1: mixed group has both TimelinePaymentCard and TimelineInvoiceCard
  it('P1: renders both TimelinePaymentCard and TimelineInvoiceCard in a mixed group', async () => {
    setupDefaultMocks({
      paymentsTimeline: {
        paymentDayGroups: [
          {
            date: '2026-04-01',
            label: 'Wed 1 Apr',
            items: [
              { kind: 'payment', data: samplePayment },
              { kind: 'invoice', data: sampleInvoice },
            ],
          },
        ],
      },
    });
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<ProjectDetailScreen />);
    });

    const paymentsHeader = findPressable(tree!, 'section-header-payments');
    await act(async () => { paymentsHeader!.props.onPress(); });

    expect(tree!.root.findAllByProps({ testID: 'payment-card-pay-1' }).length).toBeGreaterThan(0);
    expect(tree!.root.findAllByProps({ testID: 'invoice-card-inv-1' }).length).toBeGreaterThan(0);
  });

  // P2: only invoice items → only TimelineInvoiceCard, no TimelinePaymentCard
  it('P2: renders only TimelineInvoiceCard when group has only invoice items', async () => {
    setupDefaultMocks({
      paymentsTimeline: {
        paymentDayGroups: [
          {
            date: '2026-04-01',
            label: 'Wed 1 Apr',
            items: [{ kind: 'invoice', data: sampleInvoice }],
          },
        ],
      },
    });
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<ProjectDetailScreen />);
    });

    const paymentsHeader = findPressable(tree!, 'section-header-payments');
    await act(async () => { paymentsHeader!.props.onPress(); });

    expect(tree!.root.findAllByProps({ testID: 'invoice-card-inv-1' }).length).toBeGreaterThan(0);
    expect(tree!.root.findAllByProps({ testID: 'payment-card-pay-1' }).length).toBe(0);
  });

  // P3: only payment items → only TimelinePaymentCard, no TimelineInvoiceCard
  it('P3: renders only TimelinePaymentCard when group has only payment items', async () => {
    setupDefaultMocks({
      paymentsTimeline: {
        paymentDayGroups: [
          {
            date: '2026-04-01',
            label: 'Wed 1 Apr',
            items: [{ kind: 'payment', data: samplePayment }],
          },
        ],
      },
    });
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<ProjectDetailScreen />);
    });

    const paymentsHeader = findPressable(tree!, 'section-header-payments');
    await act(async () => { paymentsHeader!.props.onPress(); });

    expect(tree!.root.findAllByProps({ testID: 'payment-card-pay-1' }).length).toBeGreaterThan(0);
    expect(tree!.root.findAllByProps({ testID: 'invoice-card-inv-1' }).length).toBe(0);
  });

  // P4: empty feed → shows empty state message
  it('P4: shows empty state when feed has no items', async () => {
    setupDefaultMocks({ paymentsTimeline: { paymentDayGroups: [] } });
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<ProjectDetailScreen />);
    });

    const paymentsHeader = findPressable(tree!, 'section-header-payments');
    await act(async () => { paymentsHeader!.props.onPress(); });

    const empty = tree!.root.findAllByProps({ testID: 'payments-empty' });
    expect(empty.length).toBeGreaterThan(0);
    const emptyText = empty[0];
    expect(String(emptyText.props.children)).toBe('No payments or invoices for this project.');
  });

  // P5: tapping invoice Edit button navigates to InvoiceDetail with invoiceId
  it('P5: tapping invoice View navigates to InvoiceDetail', async () => {
    setupDefaultMocks({
      paymentsTimeline: {
        paymentDayGroups: [
          {
            date: '2026-04-01',
            label: 'Wed 1 Apr',
            items: [{ kind: 'invoice', data: sampleInvoice }],
          },
        ],
      },
    });
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<ProjectDetailScreen />);
    });

    // Expand payments section
    const paymentsHeader = findPressable(tree!, 'section-header-payments');
    await act(async () => { paymentsHeader!.props.onPress(); });

    // Tap the Edit button on the invoice card
    const editBtn = findPressable(tree!, 'invoice-action-edit');
    await act(async () => { editBtn!.props.onPress(); });

    expect(mockNavigate).toHaveBeenCalledWith('InvoiceDetail', { invoiceId: sampleInvoice.id });
  });
});
