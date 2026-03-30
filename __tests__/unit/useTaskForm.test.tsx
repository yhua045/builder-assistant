import renderer, { act } from 'react-test-renderer';
import React, { useEffect } from 'react';
import { container } from 'tsyringe';
import { useTaskForm } from '../../src/hooks/useTaskForm';
import { Task } from '../../src/domain/entities/Task';
import { wrapWithQuery } from '../utils/queryClientWrapper';

// ── helpers ───────────────────────────────────────────────────────────────────

function makeTaskRepo(overrides: Record<string, jest.Mock> = {}) {
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
    addDelayReason: jest.fn().mockResolvedValue({ id: 'dr-1' }),
    removeDelayReason: jest.fn().mockResolvedValue(undefined),
    resolveDelayReason: jest.fn().mockResolvedValue(undefined),
    findDelayReasons: jest.fn().mockResolvedValue([]),
    summarizeDelayReasons: jest.fn().mockResolvedValue([]),
    deleteDependenciesByTaskId: jest.fn().mockResolvedValue(undefined),
    deleteDelayReasonsByTaskId: jest.fn().mockResolvedValue(undefined),
    findProgressLogs: jest.fn().mockResolvedValue([]),
    addProgressLog: jest.fn(),
    updateProgressLog: jest.fn(),
    deleteProgressLog: jest.fn(),
    ...overrides,
  };
}

function makeDocRepo(overrides: Record<string, jest.Mock> = {}) {
  return {
    save: jest.fn().mockResolvedValue(undefined),
    findById: jest.fn().mockResolvedValue(null),
    findAll: jest.fn().mockResolvedValue([]),
    findByProjectId: jest.fn().mockResolvedValue([]),
    findByTaskId: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    assignProject: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeFs(overrides: Record<string, jest.Mock> = {}) {
  return {
    copyToAppStorage: jest.fn().mockResolvedValue('/app/storage/file.pdf'),
    getDocumentsDirectory: jest.fn().mockResolvedValue('/app/storage'),
    exists: jest.fn().mockResolvedValue(true),
    deleteFile: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

/** Renders the hook and waits for initial render */
async function renderForm(opts: Parameters<typeof useTaskForm>[0] = {}) {
  let latest: ReturnType<typeof useTaskForm> | null = null;

  function TestHarness() {
    const form = useTaskForm(opts);
    useEffect(() => { latest = form; }, [form]);
    return null;
  }

  await act(async () => {
    renderer.create(wrapWithQuery(<TestHarness />));
    await new Promise<void>((r) => setTimeout(r, 0));
  });

  return { getForm: () => latest! };
}

// ── DI setup ─────────────────────────────────────────────────────────────────

let taskRepo: ReturnType<typeof makeTaskRepo>;
let docRepo: ReturnType<typeof makeDocRepo>;
let fs: ReturnType<typeof makeFs>;

beforeEach(() => {
  taskRepo = makeTaskRepo();
  docRepo = makeDocRepo();
  fs = makeFs();

  jest.spyOn(container, 'resolve').mockImplementation((token: any) => {
    if (token === 'TaskRepository') return taskRepo;
    if (token === 'DocumentRepository') return docRepo;
    if (token === 'FileSystemAdapter') return fs;
    return {};
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ── tests ─────────────────────────────────────────────────────────────────────

describe.skip('useTaskForm — initial state', () => {
  it('defaults to create mode when no initialTask id', async () => {
    const { getForm } = await renderForm();
    expect(getForm().isEditMode).toBe(false);
  });

  it('is in edit mode when initialTask has an id', async () => {
    const { getForm } = await renderForm({ initialTask: { id: 'existing-task' } });
    expect(getForm().isEditMode).toBe(true);
  });

  it('pre-fills fields from initialTask', async () => {
    const { getForm } = await renderForm({
      initialTask: {
        title: 'My Task',
        notes: 'Some notes',
        status: 'in_progress',
        priority: 'high',
        subcontractorId: 'sub-1',
      },
    });
    const form = getForm();
    expect(form.title).toBe('My Task');
    expect(form.notes).toBe('Some notes');
    expect(form.status).toBe('in_progress');
    expect(form.priority).toBe('high');
    expect(form.subcontractorId).toBe('sub-1');
  });
});

describe.skip('useTaskForm — pending documents', () => {
  it('adds and removes pending documents', async () => {
    const { getForm } = await renderForm();

    await act(async () => {
      getForm().addPendingDocument({ uri: 'file:///tmp/a.pdf', filename: 'a.pdf' });
    });
    expect(getForm().pendingDocuments).toHaveLength(1);
    expect(getForm().pendingDocuments[0].filename).toBe('a.pdf');

    await act(async () => {
      getForm().removePendingDocument('file:///tmp/a.pdf');
    });
    expect(getForm().pendingDocuments).toHaveLength(0);
  });
});

describe.skip('useTaskForm — dependencies', () => {
  it('adds and removes dependency task ids', async () => {
    const { getForm } = await renderForm();

    await act(async () => { getForm().addDependencyTaskId('dep-1'); });
    expect(getForm().dependencyTaskIds).toContain('dep-1');

    await act(async () => { getForm().addDependencyTaskId('dep-1'); }); // duplicate
    expect(getForm().dependencyTaskIds).toHaveLength(1);

    await act(async () => { getForm().removeDependencyTaskId('dep-1'); });
    expect(getForm().dependencyTaskIds).toHaveLength(0);
  });
});

describe.skip('useTaskForm — validation', () => {
  it('sets validationError when title is empty', async () => {
    const { getForm } = await renderForm();

    await act(async () => { await getForm().submit(); });

    expect(getForm().validationError).toBe('Title is required');
    expect(taskRepo.save).not.toHaveBeenCalled();
  });

  it('sets validationError for self-dependency in edit mode', async () => {
    const { getForm } = await renderForm({ initialTask: { id: 'task-x', title: 'X', status: 'pending' } });

    await act(async () => { getForm().addDependencyTaskId('task-x'); });
    await act(async () => { await getForm().submit(); });

    expect(getForm().validationError).toBe('A task cannot depend on itself');
    expect(taskRepo.update).not.toHaveBeenCalled();
  });
});

describe.skip('useTaskForm — create mode submit', () => {
  it('calls CreateTaskUseCase and then AddTaskDocumentUseCase for each pending doc', async () => {
    taskRepo.save.mockResolvedValue(undefined);

    const onSuccess = jest.fn();
    const { getForm } = await renderForm({ onSuccess });

    await act(async () => { getForm().setTitle('Build deck'); });
    await act(async () => {
      getForm().addPendingDocument({ uri: 'file:///tmp/plan.pdf', filename: 'plan.pdf', mimeType: 'application/pdf' });
    });

    await act(async () => { await getForm().submit(); });

    expect(taskRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Build deck', status: 'pending' }),
    );
    expect(fs.copyToAppStorage).toHaveBeenCalledWith('file:///tmp/plan.pdf', 'plan.pdf');
    expect(docRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ filename: 'plan.pdf', localPath: '/app/storage/file.pdf' }),
    );
    expect(onSuccess).toHaveBeenCalled();
  });

  it('calls addDependency for each dependency task id', async () => {
    // findById needs to return a valid task object for AddTaskDependencyUseCase validation
    taskRepo.findById.mockResolvedValue({ id: 'any-task', title: 'Task', status: 'pending' } as Task);

    const onSuccess = jest.fn();
    const { getForm } = await renderForm({ onSuccess });

    await act(async () => { getForm().setTitle('Foundation'); });
    await act(async () => { getForm().addDependencyTaskId('dep-a'); });
    await act(async () => { getForm().addDependencyTaskId('dep-b'); });

    await act(async () => { await getForm().submit(); });

    expect(taskRepo.addDependency).toHaveBeenCalledTimes(2);
    expect(taskRepo.addDependency).toHaveBeenCalledWith(expect.any(String), 'dep-a');
    expect(taskRepo.addDependency).toHaveBeenCalledWith(expect.any(String), 'dep-b');
  });
});

describe.skip('useTaskForm — update mode submit', () => {
  const existingTask: Task = {
    id: 'task-edit-1',
    title: 'Old title',
    status: 'pending',
    dependencies: [],
  };

  it('calls UpdateTaskUseCase with new subcontractorId', async () => {
    const onSuccess = jest.fn();
    const { getForm } = await renderForm({ initialTask: existingTask, onSuccess });

    await act(async () => {
      getForm().setTitle('New title');
      getForm().setSubcontractorId('sub-99');
    });
    await act(async () => { await getForm().submit(); });

    expect(taskRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'task-edit-1', title: 'New title', subcontractorId: 'sub-99' }),
    );
    expect(onSuccess).toHaveBeenCalled();
  });

  it('attaches newly-added pending docs in update mode', async () => {
    const onSuccess = jest.fn();
    const { getForm } = await renderForm({ initialTask: existingTask, onSuccess });

    await act(async () => { getForm().setTitle('Updated task'); });
    await act(async () => {
      getForm().addPendingDocument({ uri: 'file:///tmp/photo.jpg', filename: 'photo.jpg' });
    });
    await act(async () => { await getForm().submit(); });

    expect(docRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: 'task-edit-1', filename: 'photo.jpg' }),
    );
  });
});
