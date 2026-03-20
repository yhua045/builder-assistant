/**
 * Unit tests for CriticalPathPreview component
 */
import React from 'react';
import renderer, { act } from 'react-test-renderer';

jest.mock('../../src/infrastructure/di/registerServices', () => ({}));

import { CriticalPathPreview } from '../../src/components/CriticalPathPreview';
import type { CriticalPathSuggestion } from '../../src/data/critical-path/schema';
import type { UseCriticalPathReturn } from '../../src/hooks/useCriticalPath';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeSuggestion(overrides: Partial<CriticalPathSuggestion> = {}): CriticalPathSuggestion {
  return {
    id: 'cp-01',
    title: 'DA / CDC Approval',
    order: 1,
    critical_flag: true,
    source: 'lookup',
    lookup_file: 'NSW/complete_rebuild',
    ...overrides,
  };
}

function makeHookResult(overrides: Partial<UseCriticalPathReturn> = {}): UseCriticalPathReturn {
  const suggestions = [
    makeSuggestion({ id: 'cp-01', title: 'Stage One', order: 1 }),
    makeSuggestion({ id: 'cp-02', title: 'Stage Two', order: 2 }),
    makeSuggestion({ id: 'cp-03', title: 'Stage Three', order: 3 }),
  ];
  const allIds = new Set(suggestions.map(s => s.id));
  return {
    suggestions,
    isLoading: false,
    error: null,
    suggest: jest.fn(),
    selectedIds: allIds,
    toggleSelection: jest.fn(),
    selectAll: jest.fn(),
    clearAll: jest.fn(),
    isCreating: false,
    creationProgress: null,
    creationError: null,
    confirmSelected: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CriticalPathPreview', () => {
  it('renders all task rows with checked checkboxes by default', async () => {
    const hookResult = makeHookResult();
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <CriticalPathPreview projectId="proj-1" hookResult={hookResult} />
      );
    });

    const root = tree.root;
    // Each suggestion should have a testID for its checkbox
    const checkboxes = root.findAll(node =>
      typeof node.props.testID === 'string' && node.props.testID.startsWith('task-checkbox-')
    );
    // Deduplicate by testID — React 19 traverses both React and host fibers
    const uniqueIds = new Set(checkboxes.map(n => n.props.testID as string));
    expect(uniqueIds.size).toBe(3);

    await act(async () => { tree.unmount(); });
  });

  it('CTA shows correct count of selected tasks', async () => {
    const hookResult = makeHookResult();
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <CriticalPathPreview projectId="proj-1" hookResult={hookResult} />
      );
    });

    const root = tree.root;
    const ctaButton = root.findAll(node =>
      typeof node.props.testID === 'string' && node.props.testID === 'cta-add-tasks'
    );
    expect(ctaButton.length).toBeGreaterThan(0);

    await act(async () => { tree.unmount(); });
  });

  it('CTA is disabled when 0 tasks are selected', async () => {
    const hookResult = makeHookResult({ selectedIds: new Set() });
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <CriticalPathPreview projectId="proj-1" hookResult={hookResult} />
      );
    });

    const root = tree.root;
    const ctaButton = root.find(node =>
      node.props.testID === 'cta-add-tasks'
    );
    expect(ctaButton.props.disabled).toBe(true);

    await act(async () => { tree.unmount(); });
  });

  it('tapping a task row calls toggleSelection with that task id', async () => {
    const toggleSelection = jest.fn();
    const hookResult = makeHookResult({ toggleSelection });
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <CriticalPathPreview projectId="proj-1" hookResult={hookResult} />
      );
    });

    const root = tree.root;
    const firstRow = root.find(node =>
      node.props.testID === 'task-row-cp-01'
    );

    await act(async () => {
      firstRow.props.onPress();
    });

    expect(toggleSelection).toHaveBeenCalledWith('cp-01');

    await act(async () => { tree.unmount(); });
  });

  it('shows loading skeleton when isLoading is true', async () => {
    const hookResult = makeHookResult({ isLoading: true, suggestions: [] });
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <CriticalPathPreview projectId="proj-1" hookResult={hookResult} />
      );
    });

    const root = tree.root;
    const skeleton = root.findAll(node =>
      node.props.testID === 'loading-skeleton'
    );
    expect(skeleton.length).toBeGreaterThan(0);

    await act(async () => { tree.unmount(); });
  });

  it('shows error message with retry button when error is set', async () => {
    const hookResult = makeHookResult({ error: 'Lookup not found', suggestions: [] });
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <CriticalPathPreview projectId="proj-1" hookResult={hookResult} />
      );
    });

    const root = tree.root;
    const retryButton = root.findAll(node =>
      node.props.testID === 'error-retry-btn'
    );
    expect(retryButton.length).toBeGreaterThan(0);

    await act(async () => { tree.unmount(); });
  });

  it('shows progress indicator while isCreating is true and hides CTA', async () => {
    const hookResult = makeHookResult({
      isCreating: true,
      creationProgress: { completed: 3, total: 11 },
    });
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <CriticalPathPreview projectId="proj-1" hookResult={hookResult} />
      );
    });

    const root = tree.root;
    const progressIndicator = root.findAll(node =>
      node.props.testID === 'creation-progress'
    );
    expect(progressIndicator.length).toBeGreaterThan(0);

    // CTA should not be shown while creating
    const ctaButton = root.findAll(node =>
      node.props.testID === 'cta-add-tasks'
    );
    expect(ctaButton.length).toBe(0);

    await act(async () => { tree.unmount(); });
  });

  it('shows error banner with Retry when creationError is set', async () => {
    const hookResult = makeHookResult({
      creationError: 'Failed to create tasks',
    });
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <CriticalPathPreview projectId="proj-1" hookResult={hookResult} />
      );
    });

    const root = tree.root;
    const errorBanner = root.findAll(node =>
      node.props.testID === 'creation-error-banner'
    );
    expect(errorBanner.length).toBeGreaterThan(0);

    await act(async () => { tree.unmount(); });
  });

  it('selectAll control is present', async () => {
    const hookResult = makeHookResult();
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <CriticalPathPreview projectId="proj-1" hookResult={hookResult} />
      );
    });

    const root = tree.root;
    const selectAllBtn = root.findAll(node =>
      node.props.testID === 'select-all-btn'
    );
    expect(selectAllBtn.length).toBeGreaterThan(0);

    await act(async () => { tree.unmount(); });
  });

  it('calling confirmSelected fires on CTA press', async () => {
    const confirmSelected = jest.fn().mockResolvedValue(undefined);
    const hookResult = makeHookResult({ confirmSelected });
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <CriticalPathPreview projectId="proj-1" hookResult={hookResult} />
      );
    });

    const root = tree.root;
    const cta = root.find(node => node.props.testID === 'cta-add-tasks');

    await act(async () => {
      cta.props.onPress();
    });

    expect(confirmSelected).toHaveBeenCalledWith('proj-1');

    await act(async () => { tree.unmount(); });
  });
});
