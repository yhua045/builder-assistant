import { CreateAuditLogEntryUseCase } from '../../src/application/usecases/auditlog/CreateAuditLogEntryUseCase';
import { AuditLogRepository } from '../../src/domain/repositories/AuditLogRepository';
import { AuditLog } from '../../src/domain/entities/AuditLog';

function makeMockAuditLogRepo(overrides: Partial<AuditLogRepository> = {}): AuditLogRepository {
  return {
    save: jest.fn().mockResolvedValue(undefined),
    findByProjectId: jest.fn().mockResolvedValue([]),
    findByTaskId: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe('CreateAuditLogEntryUseCase', () => {
  it('saves an entry with all required fields', async () => {
    const repo = makeMockAuditLogRepo();
    const uc = new CreateAuditLogEntryUseCase(repo);

    const entry = await uc.execute({
      projectId: 'proj-1',
      taskId: 'task-1',
      source: 'Task Form',
      action: 'Created task "Frame walls"',
    });

    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(entry.projectId).toBe('proj-1');
    expect(entry.taskId).toBe('task-1');
    expect(entry.source).toBe('Task Form');
    expect(entry.action).toBe('Created task "Frame walls"');
  });

  it('generates a unique id for each entry', async () => {
    const repo = makeMockAuditLogRepo();
    const uc = new CreateAuditLogEntryUseCase(repo);

    const a = await uc.execute({ projectId: 'proj-1', source: 'Task Form', action: 'A' });
    const b = await uc.execute({ projectId: 'proj-1', source: 'Task Form', action: 'B' });

    expect(a.id).not.toBe(b.id);
    expect(a.id).toMatch(/^audit_/);
    expect(b.id).toMatch(/^audit_/);
  });

  it('timestampUtc is a valid ISO 8601 string', async () => {
    const repo = makeMockAuditLogRepo();
    const uc = new CreateAuditLogEntryUseCase(repo);

    const entry = await uc.execute({ projectId: 'proj-1', source: 'Task Form', action: 'Test' });

    expect(() => new Date(entry.timestampUtc)).not.toThrow();
    expect(new Date(entry.timestampUtc).toISOString()).toBe(entry.timestampUtc);
  });

  it('works without an optional taskId', async () => {
    const repo = makeMockAuditLogRepo();
    const uc = new CreateAuditLogEntryUseCase(repo);

    const entry = await uc.execute({ projectId: 'proj-1', source: 'Dashboard', action: 'Project created' });

    expect(entry.taskId).toBeUndefined();
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'proj-1' }));
  });

  it('passes the saved entry to the repository', async () => {
    let saved: AuditLog | undefined;
    const repo = makeMockAuditLogRepo({
      save: jest.fn().mockImplementation(async (e: AuditLog) => { saved = e; }),
    });
    const uc = new CreateAuditLogEntryUseCase(repo);

    const entry = await uc.execute({ projectId: 'proj-2', source: 'Task Form', action: 'Updated task "Plumbing"' });

    expect(saved).toBeDefined();
    expect(saved!.id).toBe(entry.id);
  });
});
