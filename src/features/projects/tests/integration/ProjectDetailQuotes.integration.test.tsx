/**
 * Integration tests for the Quotes section of ProjectDetail.
 *
 * Covers:
 *  - Quotes section header renders with testID "section-header-quotes"
 *  - A TimelineQuotationCard renders for each quotation in the section
 *  - Empty state message when there are no quotations
 *  - Quotes section collapses when header is pressed
 *
 * Strategy: mocks the four focused hooks (useProjectDetail, useTaskTimeline,
 * usePaymentsTimeline, useQuotationsTimeline) so we test the component tree
 * in isolation without a real DB or QueryClientProvider.
 */

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { wrapWithQuery } from '../../../../../__tests__/utils/queryClientWrapper';

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('nativewind', () => ({
  cssInterop: jest.fn(),
  useColorScheme: () => ({ colorScheme: 'light' }),
}));

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockAddListener = jest.fn(() => jest.fn());

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
    addListener: mockAddListener,
  }),
  useRoute: () => ({ params: { projectId: 'proj-1' } }),
}));

jest.mock('lucide-react-native', () => ({
  ArrowLeft: 'ArrowLeft', MapPin: 'MapPin', Phone: 'Phone',
  Calendar: 'Calendar', Clock: 'Clock',
  AlertCircle: 'AlertCircle', CheckCircle: 'CheckCircle',
  XCircle: 'XCircle', Play: 'Play', ExternalLink: 'ExternalLink',
  Camera: 'Camera', Paperclip: 'Paperclip', FileText: 'FileText',
  ChevronDown: 'ChevronDown', ChevronRight: 'ChevronRight',
  Check: 'Check', X: 'X',
  Pencil: 'Pencil',
}));

// ── Four focused hook mocks ───────────────────────────────────────────────────

const mockMarkComplete = jest.fn().mockResolvedValue(undefined);
const mockInvalidateTasks = jest.fn().mockResolvedValue(undefined);
const mockInvalidatePayments = jest.fn().mockResolvedValue(undefined);
const mockInvalidateQuotations = jest.fn().mockResolvedValue(undefined);
const mockRecordPayment = jest.fn().mockResolvedValue(undefined);

let mockProjectDetailReturn: any;
let mockTaskTimelineReturn: any;
let mockPaymentsTimelineReturn: any;
let mockQuotationsTimelineReturn: any;

jest.mock('../../hooks/useProjectDetail', () => ({
  useProjectDetail: () => mockProjectDetailReturn,
}));
jest.mock('../../../tasks/hooks/useTaskTimeline', () => ({
  useTaskTimeline: () => mockTaskTimelineReturn,
}));
jest.mock('../../../payments', () => ({
  usePaymentsTimeline: () => mockPaymentsTimelineReturn,
}));
jest.mock('../../hooks/useQuotationsTimeline', () => ({
  useQuotationsTimeline: () => mockQuotationsTimelineReturn,
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const sampleProject = {
  id: 'proj-1',
  name: 'Smith Residence',
  location: '1 Oak Street',
  status: 'in_progress',
  startDate: new Date('2026-03-15'),
  expectedEndDate: new Date('2026-06-15'),
  materials: [], phases: [],
  owner: { id: 'c1', name: 'John Smith', phone: '0412 000 111' },
};

const pendingQuote = {
  id: 'q1',
  reference: 'QT-2026-001',
  date: '2026-04-10',
  total: 5000,
  currency: 'AUD',
  status: 'sent',
  vendorName: 'Acme Pty Ltd',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const acceptedQuote = {
  id: 'q2',
  reference: 'QT-2026-002',
  date: '2026-04-05',
  total: 3000,
  currency: 'AUD',
  status: 'accepted',
  vendorName: 'BuildCo',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function setHooks(quotationsOverrides?: Partial<typeof mockQuotationsTimelineReturn>) {
  mockProjectDetailReturn = {
    project: sampleProject,
    loading: false,
    error: null,
  };
  mockTaskTimelineReturn = {
    dayGroups: [],
    loading: false,
    error: null,
    markComplete: mockMarkComplete,
    invalidate: mockInvalidateTasks,
  };
  mockPaymentsTimelineReturn = {
    paymentDayGroups: [],
    loading: false,
    error: null,
    truncated: false,
    recordPayment: mockRecordPayment,
    invalidate: mockInvalidatePayments,
  };
  mockQuotationsTimelineReturn = {
    quotationDayGroups: [
      { date: '2026-04-10', label: 'Fri 10 Apr', quotations: [pendingQuote] },
    ],
    loading: false,
    error: null,
    truncated: false,
    invalidate: mockInvalidateQuotations,
    ...quotationsOverrides,
  };
}

import ProjectDetailScreen from '../../screens/ProjectDetail';

function renderScreen() {
  return renderer.create(wrapWithQuery(<ProjectDetailScreen />));
}

/** Find the Pressable node (has onPress) rather than an inner host View that also gets testID forwarded. */
function findPressableByTestID(tree: renderer.ReactTestRenderer, testID: string) {
  return tree.root.findAll(
    (node) => node.props.testID === testID && typeof node.props.onPress === 'function',
  );
}

/** Expand the quotes section by pressing its header. */
async function expandQuotesSection(tree: renderer.ReactTestRenderer) {
  const hdr = findPressableByTestID(tree, 'section-header-quotes');
  await act(async () => {
    hdr[0].props.onPress();
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ProjectDetail — Quotes section', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setHooks();
  });

  it('renders the Quotes section header', async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderScreen();
    });
    const hdr = tree!.root.findAllByProps({ testID: 'section-header-quotes' });
    expect(hdr.length).toBeGreaterThan(0);
  });

  it('renders a TimelineQuotationCard for the pending quote', async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderScreen();
    });
    // Section starts collapsed — expand it first
    await expandQuotesSection(tree!);
    const card = tree!.root.findAllByProps({ testID: 'quotation-card-q1' });
    expect(card.length).toBeGreaterThan(0);
  });

  it('renders cards for all quotations when multiple are provided', async () => {
    setHooks({
      quotationDayGroups: [
        { date: '2026-04-05', label: 'Sun 5 Apr', quotations: [acceptedQuote] },
        { date: '2026-04-10', label: 'Fri 10 Apr', quotations: [pendingQuote] },
      ],
    });
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderScreen();
    });
    // Section starts collapsed — expand it first
    await expandQuotesSection(tree!);
    const card1 = tree!.root.findAllByProps({ testID: 'quotation-card-q1' });
    const card2 = tree!.root.findAllByProps({ testID: 'quotation-card-q2' });
    expect(card1.length).toBeGreaterThan(0);
    expect(card2.length).toBeGreaterThan(0);
  });

  it('shows empty state when there are no quotations', async () => {
    setHooks({ quotationDayGroups: [] });
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderScreen();
    });
    // Section starts collapsed — expand it so the empty-state footer renders
    await expandQuotesSection(tree!);
    const empty = tree!.root.findAllByProps({ testID: 'quotes-empty' });
    expect(empty.length).toBeGreaterThan(0);
  });

  it('collapses quotes section when header is pressed', async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderScreen();
    });

    // Section starts collapsed by default (quotes: true in ProjectDetail initial state)
    // Use a predicate to find the Pressable node (which has onPress), not an inner View
    const hdr = findPressableByTestID(tree!, 'section-header-quotes');
    expect(hdr.length).toBeGreaterThan(0);

    // Expand the section
    await act(async () => {
      hdr[0].props.onPress();
    });
    const cardExpanded = tree!.root.findAllByProps({ testID: 'quotation-card-q1' });
    expect(cardExpanded.length).toBeGreaterThan(0);

    // Collapse again
    await act(async () => {
      hdr[0].props.onPress();
    });
    const cardCollapsed = tree!.root.findAllByProps({ testID: 'quotation-card-q1' });
    expect(cardCollapsed.length).toBe(0);
  });

  it('does not render quote cards when section is collapsed (default state)', async () => {
    // By default quotes section is collapsed (collapsed.quotes = true in ProjectDetail)
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderScreen();
    });
    const card = tree!.root.findAllByProps({ testID: 'quotation-card-q1' });
    expect(card.length).toBe(0);
  });
});


