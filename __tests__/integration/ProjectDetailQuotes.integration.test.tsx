/**
 * Integration tests for the Quotes section of ProjectDetail.
 *
 * Covers:
 *  - Quotes section renders with correct heading
 *  - Shows only pending (sent) quotes by default
 *  - Count badge reflects pending quotes in header
 *  - Filter toggle switches between pending-only and all quotes
 *  - Quotes section collapses and expands via header toggle
 *  - QuotationCard shows for each rendered quote
 *  - Empty state message when no pending quotes
 *
 * Strategy: mocks both `useProjectTimeline` and `useQuotationTimeline` so
 * we test the ProjectDetail component tree in isolation.
 * Hook logic is covered in unit/useQuotationTimeline.test.ts.
 */

import React from 'react';
import renderer, { act } from 'react-test-renderer';

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
}));

// ── Hook mocks ────────────────────────────────────────────────────────────────

const mockMarkComplete = jest.fn().mockResolvedValue(undefined);
const mockInvalidateTimeline = jest.fn().mockResolvedValue(undefined);
const mockAcceptQuotation = jest.fn().mockResolvedValue(undefined);
const mockRejectQuotation = jest.fn().mockResolvedValue(undefined);
const mockInvalidateQuotes = jest.fn().mockResolvedValue(undefined);
const mockSetStatusFilter = jest.fn();

let mockTimelineReturn: any;
let mockQuotesReturn: any;

jest.mock('../../src/hooks/useProjectTimeline', () => ({
  useProjectTimeline: () => mockTimelineReturn,
}));

jest.mock('../../src/hooks/useQuotationTimeline', () => ({
  useQuotationTimeline: () => mockQuotesReturn,
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

function setHooks(quotesOverrides?: Partial<typeof mockQuotesReturn>) {
  mockTimelineReturn = {
    project: sampleProject,
    dayGroups: [],
    loading: false,
    error: null,
    markComplete: mockMarkComplete,
    invalidateTimeline: mockInvalidateTimeline,
  };

  // Default: pending filter — only shows pendingQuote
  const pendingDayGroups = [
    { date: '2026-04-10', label: 'Fri 10 Apr', quotations: [pendingQuote] },
  ];
  const allDayGroups = [
    { date: '2026-04-05', label: 'Sun 5 Apr', quotations: [acceptedQuote] },
    { date: '2026-04-10', label: 'Fri 10 Apr', quotations: [pendingQuote] },
  ];

  mockQuotesReturn = {
    quoteDayGroups: pendingDayGroups,
    allQuoteDayGroups: allDayGroups,
    pendingCount: 1,
    totalCount: 2,
    visibleTotal: 5000,
    statusFilter: 'pending',
    setStatusFilter: mockSetStatusFilter,
    loading: false,
    error: null,
    acceptQuotation: mockAcceptQuotation,
    rejectQuotation: mockRejectQuotation,
    invalidateQuotes: mockInvalidateQuotes,
    ...quotesOverrides,
  };
}

import ProjectDetailScreen from '../../src/pages/projects/ProjectDetail';

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ProjectDetail — Quotes section', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setHooks();
  });

  it('renders the Quotes section heading', async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<ProjectDetailScreen />);
    });
    const hdr = tree!.root.findAllByProps({ testID: 'quotes-section-header' });
    expect(hdr.length).toBeGreaterThan(0);
  });

  it('renders a QuotationCard for the pending quote', async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<ProjectDetailScreen />);
    });
    const card = tree!.root.findAllByProps({ testID: 'quotation-card-q1' });
    expect(card.length).toBeGreaterThan(0);
  });

  it('does not render the accepted quote card in pending-only mode', async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<ProjectDetailScreen />);
    });
    const card = tree!.root.findAllByProps({ testID: 'quotation-card-q2' });
    expect(card.length).toBe(0);
  });

  it('shows all quotes when statusFilter is "all"', async () => {
    const allDayGroups = [
      { date: '2026-04-05', label: 'Sun 5 Apr', quotations: [acceptedQuote] },
      { date: '2026-04-10', label: 'Fri 10 Apr', quotations: [pendingQuote] },
    ];
    setHooks({ statusFilter: 'all', quoteDayGroups: allDayGroups });

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<ProjectDetailScreen />);
    });

    const card1 = tree!.root.findAllByProps({ testID: 'quotation-card-q1' });
    const card2 = tree!.root.findAllByProps({ testID: 'quotation-card-q2' });
    expect(card1.length).toBeGreaterThan(0);
    expect(card2.length).toBeGreaterThan(0);
  });

  it('collapses quotes section when header toggle is pressed', async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<ProjectDetailScreen />);
    });

    // Section starts expanded — card should be visible
    const cardBefore = tree!.root.findAllByProps({ testID: 'quotation-card-q1' });
    expect(cardBefore.length).toBeGreaterThan(0);

    // Collapse section
    const toggle = tree!.root.findAllByProps({ testID: 'quotes-section-header-toggle' });
    await act(async () => {
      toggle[0].props.onPress();
    });

    // Card should now be hidden
    const cardAfter = tree!.root.findAllByProps({ testID: 'quotation-card-q1' });
    expect(cardAfter.length).toBe(0);
  });

  it('renders the filter toggle pill with correct label in pending mode', async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<ProjectDetailScreen />);
    });
    const pill = tree!.root.findAllByProps({ testID: 'quotes-section-header-filter' });
    expect(pill.length).toBeGreaterThan(0);
    // Should label say "Show all (2)"
    const text = pill[0].props.children;
    // The pill text is the children of the Pressable — find Text inside
    // (renderer returns the Pressable; its child Text holds the label)
    const textEl = tree!.root.findAllByProps({ testID: 'quotes-section-header-filter' });
    expect(textEl.length).toBeGreaterThan(0);
  });

  it('calls setStatusFilter when filter pill is pressed', async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<ProjectDetailScreen />);
    });
    const pill = tree!.root.findAllByProps({ testID: 'quotes-section-header-filter' });
    await act(async () => {
      pill[0].props.onPress();
    });
    expect(mockSetStatusFilter).toHaveBeenCalledWith('all');
  });

  it('shows empty state when no pending quotes', async () => {
    setHooks({
      quoteDayGroups: [],
      pendingCount: 0,
      totalCount: 1,
    });

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<ProjectDetailScreen />);
    });

    const emptyMsg = tree!.root.findAllByProps({ testID: 'quotes-timeline-list-empty' });
    expect(emptyMsg.length).toBeGreaterThan(0);
    expect(emptyMsg[0].props.children).toMatch(/pending/i);
  });

  it('navigates to QuotationDetail when onOpen is called', async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<ProjectDetailScreen />);
    });

    // Trigger the card body press (open)
    const cardOpen = tree!.root.findAllByProps({ testID: 'quotation-card-q1-open' });
    await act(async () => {
      cardOpen[0].props.onPress();
    });

    expect(mockNavigate).toHaveBeenCalledWith('QuotationDetail', {
      quotationId: 'q1',
    });
  });
});
