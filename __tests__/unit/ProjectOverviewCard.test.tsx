/**
 * Unit tests for ProjectOverviewCard
 * Covers acceptance criteria P1–P6 from design/issue-164-dashboard-ui-refined.md
 */
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { ProjectOverviewCard } from '../../src/pages/dashboard/components/ProjectOverviewCard';
import { ProjectOverview } from '../../src/hooks/useProjectsOverview';
import { ProjectStatus } from '../../src/domain/entities/Project';

// Mock sub-components to isolate unit under test
jest.mock('../../src/pages/dashboard/components/PhaseProgressRow', () => ({
  PhaseProgressRow: ({ phaseOverview }: { phaseOverview: { phaseId: string | null } }) => {
    const { Text } = require('react-native');
    return <Text testID={`phase-row-${phaseOverview.phaseId ?? 'unassigned'}`}>{phaseOverview.phaseId}</Text>;
  },
}));

jest.mock('../../src/components/dashboard/PendingPaymentBadge', () => ({
  PendingPaymentBadge: ({ amount }: { amount: number }) => {
    if (!amount || amount === 0) return null;
    const { Text } = require('react-native');
    return <Text testID="pending-payment-badge">${amount}</Text>;
  },
}));

// ── helpers ──────────────────────────────────────────────────────────────────

function makeOverview(overrides: Partial<ProjectOverview> = {}): ProjectOverview {
  return {
    project: {
      id: overrides.project?.id ?? 'p1',
      name: overrides.project?.name ?? 'Test Project',
      createdAt: new Date(),
      updatedAt: new Date(),
      status: ProjectStatus.IN_PROGRESS,
      materials: [],
      phases: [],
    },
    progressPercent: 60,
    criticalTasksCompleted: 3,
    criticalTasksTotal: 5,
    nextCriticalTask: null,
    overdueCriticalTasksCount: 0,
    dueSoonCriticalTasksCount: 0,
    criticalTasks: [],
    nonCriticalTasks: [],
    totalPendingPayment: 0,
    phaseOverviews: [],
    totalTasksCount: 5,
    totalTasksCompleted: 3,
    allTasksPercent: 60,
    overallStatus: 'on_track',
    blockedTasks: [],
    ...overrides,
  };
}

async function createCard(overview: ProjectOverview, onPress: jest.Mock): Promise<renderer.ReactTestRenderer> {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<ProjectOverviewCard overview={overview} onPress={onPress} />);
  });
  return tree;
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('ProjectOverviewCard', () => {
  // P1: initially shows "View Details" and is not expanded
  it('P1: renders collapsed by default with "View Details" text', async () => {
    const onPress = jest.fn();
    const tree = await createCard(makeOverview(), onPress);
    const root = tree.root;

    const texts = root.findAll(node => (node.type as string) === 'Text' && node.props.children === 'View Details');
    expect(texts.length).toBeGreaterThanOrEqual(1);

    // No PhaseProgressRow rendered yet
    const phaseRows = root.findAll(node => node.props.testID?.startsWith?.('phase-row-'));
    expect(phaseRows.length).toBe(0);
  });

  // P2: pressing toggle expands and shows PhaseProgressRow per phase
  it('P2: pressing "View Details" expands and renders PhaseProgressRow per phaseOverview', async () => {
    const phaseOverviews = [
      { phaseId: 'ph1', phaseName: 'Phase 1', tasks: [], totalCount: 0, completedCount: 0, progressPercent: 0, isBlocked: false, criticalCompleted: 0, criticalTotal: 0 },
      { phaseId: 'ph2', phaseName: 'Phase 2', tasks: [], totalCount: 0, completedCount: 0, progressPercent: 0, isBlocked: false, criticalCompleted: 0, criticalTotal: 0 },
    ];

    const onPress = jest.fn();
    const tree = await createCard(makeOverview({ phaseOverviews }), onPress);
    const root = tree.root;

    // Find the toggle button by its text
    const toggleText = root.findAll(node => (node.type as string) === 'Text' && node.props.children === 'View Details');
    expect(toggleText.length).toBeGreaterThanOrEqual(1);

    // Find the toggle Pressable — it is the one not wired to navigation onPress
    // Strategy: find Pressable by onPress not equal to navigation handler
    const allPressables = root.findAll(node =>
      node.props?.onPress && typeof node.props.onPress === 'function' && node.props.onPress !== onPress
    );
    const togglePressable = allPressables.find(node =>
      node.findAll(n => (n.type as string) === 'Text' && n.props.children === 'View Details').length > 0
    );
    expect(togglePressable).toBeTruthy();

    await act(async () => {
      togglePressable!.props.onPress();
    });

    const showLessTexts = root.findAll(node => (node.type as string) === 'Text' && node.props.children === 'Show Less');
    expect(showLessTexts.length).toBeGreaterThanOrEqual(1);

    const phaseRows = root.findAll(node => (node.type as string) === 'Text' && node.props.testID?.startsWith?.('phase-row-'));
    expect(phaseRows.length).toBe(2);
  });

  // P3: PendingPaymentBadge not rendered when totalPendingPayment === 0
  it('P3: does not render PendingPaymentBadge when totalPendingPayment is 0', async () => {
    const tree = await createCard(makeOverview({ totalPendingPayment: 0 }), jest.fn());
    const badges = tree.root.findAll(node => node.props.testID === 'pending-payment-badge');
    expect(badges.length).toBe(0);
  });

  // P3b: PendingPaymentBadge IS rendered when totalPendingPayment > 0
  it('P3b: renders PendingPaymentBadge when totalPendingPayment > 0', async () => {
    const tree = await createCard(makeOverview({ totalPendingPayment: 5000 }), jest.fn());
    const badges = tree.root.findAll(node => (node.type as string) === 'Text' && node.props.testID === 'pending-payment-badge');
    expect(badges.length).toBe(1);
  });

  // P4: overallStatus === 'blocked' → progress bar className includes 'bg-red-500'
  it('P4: progress bar has bg-red-500 class when overallStatus is blocked', async () => {
    const tree = await createCard(makeOverview({ overallStatus: 'blocked' }), jest.fn());
    const redBars = tree.root.findAll(
      node =>
        (node.type as string) === 'View' &&
        typeof node.props.className === 'string' &&
        node.props.className.includes('bg-red-500') &&
        node.props.className.includes('h-full')
    );
    expect(redBars.length).toBeGreaterThanOrEqual(1);
  });

  // P5: card onPress fires navigation handler, NOT the expand toggle
  it('P5: card onPress fires navigation callback and does not toggle expand', async () => {
    const onPress = jest.fn();
    const tree = await createCard(makeOverview(), onPress);
    const root = tree.root;

    // Find the outermost Pressable (the navigation one) by checking onPress ref
    const cardPressable = root.findAll(node =>
      node.props?.onPress === onPress
    );
    expect(cardPressable.length).toBeGreaterThanOrEqual(1);

    await act(async () => {
      cardPressable[0].props.onPress();
    });

    expect(onPress).toHaveBeenCalledTimes(1);

    // Still collapsed
    const viewDetailTexts = root.findAll(
      node => (node.type as string) === 'Text' && node.props.children === 'View Details'
    );
    expect(viewDetailTexts.length).toBeGreaterThanOrEqual(1);
  });

  // P6: two cards expand independently
  it('P6: expanding one card does not expand the other', async () => {
    const { View } = require('react-native');

    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <View>
          <ProjectOverviewCard overview={makeOverview({ project: { id: 'p1', name: 'Card A', createdAt: new Date(), updatedAt: new Date(), status: ProjectStatus.IN_PROGRESS, materials: [], phases: [] } })} onPress={jest.fn()} />
          <ProjectOverviewCard overview={makeOverview({ project: { id: 'p2', name: 'Card B', createdAt: new Date(), updatedAt: new Date(), status: ProjectStatus.IN_PROGRESS, materials: [], phases: [] } })} onPress={jest.fn()} />
        </View>
      );
    });

    const root = tree.root;

    // Both start with 'View Details'
    const allViewDetails = root.findAll(
      node => (node.type as string) === 'Text' && node.props.children === 'View Details'
    );
    expect(allViewDetails.length).toBe(2);

    // Find all toggle Pressables (className contains bg-muted/20)
    const togglePressables = root.findAll(
      node =>
        typeof node.props.className === 'string' &&
        node.props.className.includes('bg-muted/20') &&
        typeof node.props.onPress === 'function'
    );
    expect(togglePressables.length).toBeGreaterThanOrEqual(2);

    // Expand first card
    await act(async () => {
      togglePressables[0].props.onPress();
    });

    const showLess = root.findAll(node => (node.type as string) === 'Text' && node.props.children === 'Show Less');
    const viewDetails = root.findAll(node => (node.type as string) === 'Text' && node.props.children === 'View Details');
    expect(showLess.length).toBe(1);
    expect(viewDetails.length).toBe(1);
  });
});
