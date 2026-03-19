import { GetAuditLogsByTaskUseCase } from '../../src/application/usecases/auditlog/GetAuditLogsByTaskUseCase';
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

function makeEntry(id: string, timestampUtc: string, overrides: Partial<AuditLog> = {}): AuditLog {
  return {
    id,
    projectId: 'proj-1',
    taskId: 'task-1',
    timestampUtc,
    source: 'Task Form',
    action: `Action ${id}`,
    ...overrides,
  };
}

describe('GetAuditLogsByTaskUseCase', () => {
  it('delegates to findByTaskId with the given taskId', async () => {
    const repo = makeMockAuditLogRepo();
    const uc = new GetAuditLogsByTaskUseCase(repo);

    await uc.execute('task-abc');

    expect(repo.findByTaskId).toHaveBeenCalledWith('task-abc');
  });

  it('returns an empty array when there are no logs', async () => {
    const repo = makeMockAuditLogRepo({ findByTaskId: jest.fn().mockResolvedValue([]) });
    const uc = new GetAuditLogsByTaskUseCase(repo);

    const result = await uc.execute('task-empty');

    expect(result).toEqual([]);
  });

  it('returns logs sorted newest-first', async () => {
    const older = makeEntry('a', '2026-01-01T08:00:00.000Z');
    const newer = makeEntry('b', '2026-01-02T08:00:00.000Z');
    const newest = makeEntry('c', '2026-01-03T08:00:00.000Z');

    const repo = makeMockAuditLogRepo({
      findByTaskId: jest.fn().mockResolvedValue([newer, newest, older]),
    });
    const uc = new GetAuditLogsByTaskUseCase(repo);

    const result = await uc.execute('task-1');

    expect(result[0].id).toBe('c');
    expect(result[1].id).toBe('b');
    expect(result[2].id).toBe('a');
  });

  it('does not call findByProjectId', async () => {
    const repo = makeMockAuditLogRepo();
    const uc = new GetAuditLogsByTaskUseCase(repo);

    await uc.execute('task-1');

    expect(repo.findByProjectId).not.toHaveBeenCalled();
  });
});
