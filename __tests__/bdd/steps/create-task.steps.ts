import { defineFeature, loadFeature } from 'jest-cucumber';
import path from 'path';
import { CreateTaskUseCase } from '../../../src/features/tasks/application/CreateTaskUseCase';
import type { TaskRepository } from '../../../src/shared/domain/repositories/TaskRepository';
import type { Task } from '../../../src/shared/domain/entities/Task';

const feature = loadFeature(
  path.join(__dirname, '../features/create-task.feature'),
);

function makeMockTaskRepo(overrides: Partial<TaskRepository> = {}): jest.Mocked<TaskRepository> {
  return {
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
    addDelayReason: jest.fn().mockResolvedValue({ id: 'dr-1', taskId: '', reasonTypeId: '', createdAt: '' }),
    removeDelayReason: jest.fn().mockResolvedValue(undefined),
    resolveDelayReason: jest.fn().mockResolvedValue(undefined),
    findDelayReasons: jest.fn().mockResolvedValue([]),
    summarizeDelayReasons: jest.fn().mockResolvedValue([]),
    deleteDependenciesByTaskId: jest.fn().mockResolvedValue(undefined),
    deleteDelayReasonsByTaskId: jest.fn().mockResolvedValue(undefined),
    findProgressLogs: jest.fn().mockResolvedValue([]),
    addProgressLog: jest.fn().mockResolvedValue({ id: 'pl-1', taskId: '', note: '', createdAt: '' }),
    updateProgressLog: jest.fn().mockResolvedValue({ id: 'pl-1', taskId: '', note: '', createdAt: '' }),
    deleteProgressLog: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as jest.Mocked<TaskRepository>;
}

defineFeature(feature, test => {
  let useCase: CreateTaskUseCase;
  let mockRepo: jest.Mocked<TaskRepository>;
  let result: Task;
  let caughtError: Error | undefined;

  beforeEach(() => {
    mockRepo = makeMockTaskRepo();
    useCase = new CreateTaskUseCase(mockRepo);
    caughtError = undefined;
  });

  test('Creating a task with all required fields', ({ given, when, then, and }) => {
    given(/^a project with id "(.*)" exists$/, (_projectId: string) => {
      // No-op: repository is mocked — no real DB needed
    });

    when(
      /^I create a task with title "(.*)" for project "(.*)"$/,
      async (title: string, projectId: string) => {
        result = await useCase.execute({ title, projectId, status: 'pending' });
      },
    );

    then(/^the task is saved with status "(.*)"$/, (status: string) => {
      expect(result.status).toBe(status);
    });

    and(/^the task title is "(.*)"$/, (title: string) => {
      expect(result.title).toBe(title);
    });
  });

  test('Creating a task with a predetermined id', ({ given, when, then }) => {
    given(/^a project with id "(.*)" exists$/, (_projectId: string) => {
      // No-op
    });

    when(
      /^I create a task with id "(.*)" and title "(.*)" for project "(.*)"$/,
      async (id: string, title: string, projectId: string) => {
        result = await useCase.execute({ id, title, projectId, status: 'pending' });
      },
    );

    then(/^the task is saved with id "(.*)"$/, (expectedId: string) => {
      expect(result.id).toBe(expectedId);
    });
  });

  test('Creating a task without a title fails', ({ given, when, then }) => {
    given(/^a project with id "(.*)" exists$/, (_projectId: string) => {
      // No-op
    });

    when(
      /^I try to create a task with no title for project "(.*)"$/,
      async (projectId: string) => {
        try {
          // Pass an empty title to trigger validation failure
          result = await useCase.execute({ title: '', projectId, status: 'pending' });
        } catch (err) {
          caughtError = err as Error;
        }
      },
    );

    then(/^the task creation should fail with a validation error$/, () => {
      expect(caughtError).toBeDefined();
      expect(caughtError).toBeInstanceOf(Error);
    });
  });
});
