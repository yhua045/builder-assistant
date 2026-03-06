/**
 * Unit tests for useTaskDetail hook
 * (src/hooks/useTaskDetail.ts)
 *
 * Uses a tiny wrapper component to exercise the hook via react-test-renderer.
 * The _overrideSvc injection parameter is used to provide a mock SuggestionService
 * without requiring DI container setup.
 *
 * Feature flag is mocked to 'true' so we can test the suggestion fetch path.
 * For the 'flag off' path, see the TaskIndex/TaskBottomSheet integration tests.
 */
import React from 'react';
import renderer, { act } from 'react-test-renderer';

// Mock DI registration to avoid native module resolution during unit tests
jest.mock('../../src/infrastructure/di/registerServices', () => ({}));

// Enable the AI flag for these tests
jest.mock('../../src/config/featureFlags', () => ({
  FEATURE_AI_SUGGESTIONS: true,
}));

import { useTaskDetail } from '../../src/hooks/useTaskDetail';
import type { Task } from '../../src/domain/entities/Task';
import type { Project } from '../../src/domain/entities/Project';
import type {
  SuggestionService,
  SuggestionResult,
} from '../../src/infrastructure/ai/suggestionService';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-1',
  title: 'Frame Roof Plates',
  status: 'blocked',
  description: 'Install LVL ridge beam before fixing roof plates.',
  photos: ['file:///photo1.jpg'],
  siteConstraints: 'Crane access from north side only.',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  ...overrides,
});

const makeProject = (overrides: Partial<Project> = {}): Project => ({
  id: 'project-1',
  name: 'Hillside Reno',
  status: 'in_progress' as any,
  location: '12 Builder St, Sydney',
  fireZone: 'BAL-29',
  regulatoryFlags: ['Heritage Overlay'],
  materials: [],
  phases: [],
  ...overrides,
});

const MOCK_RESULT: SuggestionResult = {
  suggestion: 'Check if the ridge beam delivery has been rescheduled.',
  confidence: 'medium',
  disclaimer: 'AI-generated content. Verify with a qualified professional.',
};

function makeMockService(result: SuggestionResult | null): SuggestionService {
  return {
    getSuggestion: jest.fn().mockResolvedValue(result),
  };
}

/** Simple wrapper component so we can test the hook via react-test-renderer */
interface WrapperProps {
  task: Task | null;
  project: Project | null;
  service: SuggestionService;
  onResult: (suggestion: SuggestionResult | null, loading: boolean) => void;
}
function HookWrapper({ task, project, service, onResult }: WrapperProps) {
  const { suggestion, loadingSuggestion } = useTaskDetail(task, project, service);
  onResult(suggestion, loadingSuggestion);
  return null;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useTaskDetail', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // TC-UD-1
  it('calls getSuggestion with correct context fields', async () => {
    const task = makeTask();
    const project = makeProject();
    const service = makeMockService(MOCK_RESULT);
    const onResult = jest.fn();

    await act(async () => {
      renderer.create(
        <HookWrapper task={task} project={project} service={service} onResult={onResult} />,
      );
    });

    expect(service.getSuggestion).toHaveBeenCalledTimes(1);
    expect(service.getSuggestion).toHaveBeenCalledWith({
      taskId: 'task-1',
      description: 'Install LVL ridge beam before fixing roof plates.',
      photos: ['file:///photo1.jpg'],
      siteConstraints: 'Crane access from north side only.',
      projectLocation: '12 Builder St, Sydney',
      fireZone: 'BAL-29',
      regulatoryFlags: ['Heritage Overlay'],
    });
  });

  // TC-UD-2
  it('returns the suggestion result from the service', async () => {
    const task = makeTask();
    const project = makeProject();
    const service = makeMockService(MOCK_RESULT);
    const onResult = jest.fn();

    await act(async () => {
      renderer.create(
        <HookWrapper task={task} project={project} service={service} onResult={onResult} />,
      );
    });

    // Last call should have the resolved suggestion and loading=false
    const calls = onResult.mock.calls;
    const lastCall = calls[calls.length - 1];
    expect(lastCall[0]).toEqual(MOCK_RESULT);
    expect(lastCall[1]).toBe(false); // loadingSuggestion = false
  });

  // TC-UD-3
  it('returns null when the service resolves with null', async () => {
    const service = makeMockService(null);
    const onResult = jest.fn();

    await act(async () => {
      renderer.create(
        <HookWrapper
          task={makeTask()}
          project={makeProject()}
          service={service}
          onResult={onResult}
        />,
      );
    });

    const calls = onResult.mock.calls;
    const lastCall = calls[calls.length - 1];
    expect(lastCall[0]).toBeNull();
  });

  // TC-UD-4
  it('returns null immediately when task is null', async () => {
    const service = makeMockService(MOCK_RESULT);
    const onResult = jest.fn();

    await act(async () => {
      renderer.create(
        <HookWrapper task={null} project={makeProject()} service={service} onResult={onResult} />,
      );
    });

    expect(service.getSuggestion).not.toHaveBeenCalled();
    const lastCall = onResult.mock.calls[onResult.mock.calls.length - 1];
    expect(lastCall[0]).toBeNull();
  });

  // TC-UD-5
  it('handles service errors gracefully (returns null, does not throw)', async () => {
    const service: SuggestionService = {
      getSuggestion: jest.fn().mockRejectedValue(new Error('Network error')),
    };
    const onResult = jest.fn();

    await act(async () => {
      renderer.create(
        <HookWrapper
          task={makeTask()}
          project={makeProject()}
          service={service}
          onResult={onResult}
        />,
      );
    });

    const calls = onResult.mock.calls;
    const lastCall = calls[calls.length - 1];
    expect(lastCall[0]).toBeNull();
    expect(lastCall[1]).toBe(false); // loadingSuggestion back to false
  });
});
