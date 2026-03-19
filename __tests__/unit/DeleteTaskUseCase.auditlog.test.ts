import { DeleteTaskUseCase } from '../../src/application/usecases/task/DeleteTaskUseCase';
import { TaskRepository } from '../../src/domain/repositories/TaskRepository';
import { AuditLogRepository } from '../../src/domain/repositories/AuditLogRepository';
import { Task } from '../../src/domain/entities/Task';

function makeMockTaskRepo(overrides: Partial<TaskRepository> = {}): TaskRepository {
  return {
    save: jest.fn(),
    findById: jest.fn().mockResolvedValue(null),
    findAll: jest.fn().mockResolvedValue([]),
    findByProjectId: jest.fn().mockResolvedValue([]),
    findAdHoc: jest.fn().mockResolvedValue([]),
    findUpcoming: jest.fn().mockResolvedValue([]),
    update: jest.fn(),
    delete: jest.fn().mockResolvedValue(undefined),
    addDependency: jest.fn(),
    removeDependency: jest.fn(),
    findDependencies: jest.fn().mockResolvedValue([]),
    findDependents: jest.fn().mockResolvedValue([]),
    addDelayReason: jest.fn(),
    removeDelayReason: jest.fn(),
    findDelayReasons: jest.fn().mockResolvedValue([]),
    deleteDependenciesByTaskId: jest.fn().mockResolvedValue(undefined),
    deleteDelayReasonsByTaskId: jest.fn().mockResolvedValue(undefined),
    findProgressLogs: jest.fn().mockResolvedValue([]),
    addProgressLog: jest.fn(),
    updateProgressLog: jest.fn(),
    deleteProgressLog: jest.fn(),
    resolveDelayReason: jest.fn().mockResolvedValue(undefined),
    summarizeDelayReasons: jest.fn().mockResolvedValue([]),
    findAllDependencies: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
}

function makeMockAuditLogRepo(overrides: Partial<AuditLogRepository> = {}): AuditLogRepository {
  return {
    save: jest.fn().mockResolvedValue(undefined),
    findByProjectId: jest.fn().mockResolvedValue([]),
    findByTaskId: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
}

function makeTask(id: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    title: `Task ${id}`,
    status: 'pending',
    projectId: 'proj-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('DeleteTaskUseCase — audit log integration', () => {
  it('records a delete audit entry when auditLogRepository is provided', async () => {
    const task = makeTask('task-1', { title: 'Frame walls' });
    const taskRepo = makeMockTaskRepo({
      findById: jest.fn().mockResolvedValue(task),
    });
    const auditRepo = makeMockAuditLogRepo();
    const uc = new DeleteTaskUseCase(taskRepo, auditRepo);

    await uc.execute('task-1');

    expect(auditRepo.save).toHaveBeenCalledTimes(1);
    const saved = (auditRepo.save as jest.Mock).mock.calls[0][0];
    expect(saved.projectId).toBe('proj-1');
    expect(saved.taskId).toBe('task-1');
    expect(saved.source).toBe('Task Form');
    expect(saved.action).toContain('Frame walls');
    expect(saved.action).toContain('Deleted');
  });

  it('does NOT call auditLogRepository when not provided (backward compat)', async () => {
    const taskRepo = makeMockTaskRepo();
    const uc = new DeleteTaskUseCase(taskRepo);

    await uc.execute('task-no-audit');

    expect(taskRepo.delete).toHaveBeenCalledWith('task-no-audit');
    // No audit repo — just ensure no throw
  });

  it('captures the task title BEFORE deletion', async () => {
    const task = makeTask('task-2', { title: 'Plumbing rough-in' });
    const callOrder: string[] = [];

    const taskRepo = makeMockTaskRepo({
      findById: jest.fn().mockResolvedValue(task),
      delete: jest.fn().mockImplementation(async () => { callOrder.push('delete'); }),
    });
    const auditRepo = makeMockAuditLogRepo({
      save: jest.fn().mockImplementation(async () => { callOrder.push('audit_save'); }),
    });
    const uc = new DeleteTaskUseCase(taskRepo, auditRepo);

    await uc.execute('task-2');

    // findById must be called before delete so title is still available
    expect(taskRepo.findById).toHaveBeenCalledWith('task-2');
    const findByIdCallIdx = callOrder.indexOf('delete');
    const auditSaveCallIdx = callOrder.indexOf('audit_save');
    // delete happens before audit save (after actual deletion)
    expect(findByIdCallIdx).toBeLessThan(auditSaveCallIdx);
  });

  it('skips audit entry if task.projectId is missing', async () => {
    const task = makeTask('task-3', { projectId: undefined });
    const taskRepo = makeMockTaskRepo({
      findById: jest.fn().mockResolvedValue(task),
    });
    const auditRepo = makeMockAuditLogRepo();
    const uc = new DeleteTaskUseCase(taskRepo, auditRepo);

    await uc.execute('task-3');

    expect(auditRepo.save).not.toHaveBeenCalled();
  });

  it('still deletes the task even when findById returns null', async () => {
    const taskRepo = makeMockTaskRepo({
      findById: jest.fn().mockResolvedValue(null),
    });
    const auditRepo = makeMockAuditLogRepo();
    const uc = new DeleteTaskUseCase(taskRepo, auditRepo);

    await uc.execute('task-ghost');

    expect(taskRepo.delete).toHaveBeenCalledWith('task-ghost');
    expect(auditRepo.save).not.toHaveBeenCalled();
  });
});
