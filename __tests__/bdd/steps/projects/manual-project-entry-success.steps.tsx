/**
 * BDD step definitions — Manual project creation flow
 * Feature: __tests__/bdd/features/projects/manual-project-entry-success.feature
 *
 * Covers the component-integration scenario that validates the full orchestration:
 *   form input → save → createProject → suggest → step transition
 */
import { defineFeature, loadFeature } from 'jest-cucumber';
import path from 'path';
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { container } from 'tsyringe';

// ── Module mocks (hoisted by Jest) ────────────────────────────────────────────

jest.mock('lucide-react-native', () => ({
  X: 'X',
  ChevronRight: 'ChevronRight',
  ChevronDown: 'ChevronDown',
  Check: 'Check',
}));

jest.mock('../../../../src/components/inputs/DatePickerInput', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: () => React.createElement(View, { testID: 'mock-date-picker' }),
  };
});

jest.mock('../../../../src/components/inputs/ContactSelector', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: () => React.createElement(View, { testID: 'mock-contact-selector' }),
  };
});

jest.mock('../../../../src/components/inputs/TeamSelector', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: () => React.createElement(View, { testID: 'mock-team-selector' }),
  };
});

// Mock CriticalPathPreview to render a test-friendly stub that exposes the projectId
jest.mock(
  '../../../../src/features/projects/components/CriticalPathPreview/CriticalPathPreview',
  () => {
    const React = require('react');
    const { View, Text } = require('react-native');
    return {
      __esModule: true,
      CriticalPathPreview: ({ projectId }: { projectId: string }) =>
        React.createElement(
          View,
          { testID: 'critical-path-preview' },
          React.createElement(Text, null, projectId),
        ),
    };
  },
);

// Prevent native module resolution during tests
jest.mock('../../../../src/infrastructure/di/registerServices', () => ({}));

jest.mock('../../../../src/features/tasks/infrastructure/DrizzleTaskRepository', () => ({
  DrizzleTaskRepository: jest.fn().mockImplementation(() => ({})),
}));

// Mock the hooks under test
jest.mock('../../../../src/features/projects/hooks/useProjects');
jest.mock('../../../../src/hooks/useCriticalPath');

// ── Import mocked hooks ───────────────────────────────────────────────────────

import { useProjects } from '../../../../src/features/projects/hooks/useProjects';
import { useCriticalPath } from '../../../../src/hooks/useCriticalPath';

const mockUseProjects = useProjects as jest.MockedFunction<typeof useProjects>;
const mockUseCriticalPath = useCriticalPath as jest.MockedFunction<typeof useCriticalPath>;

// ── Import component under test (after mocks) ─────────────────────────────────

import ManualProjectEntry from '../../../../src/features/projects/components/ManualProjectEntry';

// ── Shared mock refs (stable across step calls) ───────────────────────────────

const mockCreateProject = jest.fn();
const mockSuggest = jest.fn();

// ── Feature ───────────────────────────────────────────────────────────────────

const feature = loadFeature(
  path.join(__dirname, '../../features/projects/manual-project-entry-success.feature'),
);

defineFeature(feature, test => {
  let rendered: ReturnType<typeof render>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Configure useProjects mock with a stable createProject reference
    mockUseProjects.mockReturnValue({
      projects: [],
      loading: false,
      error: null,
      createProject: mockCreateProject,
      getProjectAnalysis: jest.fn().mockResolvedValue({}),
      refreshProjects: jest.fn().mockResolvedValue(undefined),
    });

    // Configure useCriticalPath mock with a stable suggest reference
    mockUseCriticalPath.mockReturnValue({
      suggestions: [],
      isLoading: false,
      error: null,
      suggest: mockSuggest,
      selectedIds: new Set(),
      toggleSelection: jest.fn(),
      selectAll: jest.fn(),
      clearAll: jest.fn(),
      isCreating: false,
      creationProgress: null,
      creationError: null,
      confirmSelected: jest.fn().mockResolvedValue(undefined),
    });

    // Register a lightweight TaskRepository stub in the DI container
    container.register('TaskRepository', {
      useValue: {
        save: jest.fn().mockResolvedValue(undefined),
        findById: jest.fn().mockResolvedValue(null),
        findAll: jest.fn().mockResolvedValue([]),
        findByProjectId: jest.fn().mockResolvedValue([]),
        findAdHoc: jest.fn().mockResolvedValue([]),
        findUpcoming: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue(undefined),
        delete: jest.fn().mockResolvedValue(undefined),
        addDependency: jest.fn().mockResolvedValue(undefined),
        removeDependency: jest.fn().mockResolvedValue(undefined),
        findDependencies: jest.fn().mockResolvedValue([]),
        findDependents: jest.fn().mockResolvedValue([]),
        findAllDependencies: jest.fn().mockResolvedValue([]),
        addDelayReason: jest.fn().mockResolvedValue(undefined),
        removeDelayReason: jest.fn().mockResolvedValue(undefined),
        resolveDelayReason: jest.fn().mockResolvedValue(undefined),
        findDelayReasons: jest.fn().mockResolvedValue([]),
        summarizeDelayReasons: jest.fn().mockResolvedValue([]),
        deleteDependenciesByTaskId: jest.fn().mockResolvedValue(undefined),
        deleteDelayReasonsByTaskId: jest.fn().mockResolvedValue(undefined),
        findProgressLogs: jest.fn().mockResolvedValue([]),
        addProgressLog: jest.fn().mockResolvedValue(undefined),
        updateProgressLog: jest.fn().mockResolvedValue(undefined),
        deleteProgressLog: jest.fn().mockResolvedValue(undefined),
      },
    });
  });

  test(
    'Successful save moves to task suggestion step with selected project type and state',
    ({ given, when, then, and }) => {
      // ── Given ────────────────────────────────────────────────────────────────

      given('I open the manual project entry form', () => {
        rendered = render(
          <ManualProjectEntry initialVisible={true} hideButton={true} />,
        );
      });

      and(/^I enter project name "([^"]*)"$/, (projectName: string) => {
        fireEvent.changeText(
          rendered.getByPlaceholderText('Project name'),
          projectName,
        );
      });

      and(/^I enter address "([^"]*)"$/, (address: string) => {
        fireEvent.changeText(
          rendered.getByPlaceholderText('Property address'),
          address,
        );
      });

      and(/^I choose project type "([^"]*)"$/, (projectType: string) => {
        // OptionList renders each option with testID `option-${opt.value}`
        // e.g. "Renovation" → value "renovation" → testID "option-renovation"
        fireEvent.press(
          rendered.getByTestId(`option-${projectType.toLowerCase()}`),
        );
      });

      and(/^I choose state "([^"]*)"$/, (state: string) => {
        fireEvent.press(rendered.getByTestId('dropdown-state'));
        fireEvent.press(rendered.getByText(state));
      });

      and(
        /^create project succeeds with project id "([^"]*)"$/,
        (projectId: string) => {
          mockCreateProject.mockResolvedValueOnce({
            success: true,
            projectId,
          });
        },
      );

      // ── When ─────────────────────────────────────────────────────────────────

      when(/^I press "([^"]*)"$/, async (buttonLabel: string) => {
        await act(async () => {
          fireEvent.press(rendered.getByText(buttonLabel));
        });
      });

      // ── Then ─────────────────────────────────────────────────────────────────

      then(
        /^create project should be called with projectType "([^"]*)" and state "([^"]*)"$/,
        (projectType: string, state: string) => {
          expect(mockCreateProject).toHaveBeenCalledWith(
            expect.objectContaining({ projectType, state }),
          );
        },
      );

      and(
        /^the critical path suggestion should be requested with project_type "([^"]*)" and state "([^"]*)"$/,
        (projectType: string, state: string) => {
          expect(mockSuggest).toHaveBeenCalledWith({
            project_type: projectType,
            state,
          });
        },
      );

      and(
        /^the task suggestion step should be visible for project "([^"]*)"$/,
        (projectId: string) => {
          // "Step 2 of 2" text confirms the form has transitioned to the tasks step
          expect(
            rendered.getByText('Step 2 of 2 · Select your starting tasks'),
          ).toBeTruthy();
          // The mocked CriticalPathPreview renders a testID and the projectId as text
          expect(rendered.getByTestId('critical-path-preview')).toBeTruthy();
          expect(rendered.getByText(projectId)).toBeTruthy();
        },
      );
    },
  );
});
