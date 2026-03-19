import { GetAuditLogsByProjectUseCase } from '../../src/application/usecases/auditlog/GetAuditLogsByProjectUseCase';
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
    timestampUtc,
    source: 'Task Form',
    action: `Action ${id}`,
    ...overrides,
  };
}

describe('GetAuditLogsByProjectUseCase', () => {
  it('delegates to findByProjectId with the given projectId', async () => {
    const repo = makeMockAuditLogRepo();
    const uc = new GetAuditLogsByProjectUseCase(repo);

    await uc.execute('proj-abc');

    expect(repo.findByProjectId).toHaveBeenCalledWith('proj-abc');
  });

  it('returns an empty array when there are no logs', async () => {
    const repo = makeMockAuditLogRepo({ findByProjectId: jest.fn().mockResolvedValue([]) });
    const uc = new GetAuditLogsByProjectUseCase(repo);

    const result = await uc.execute('proj-empty');

    expect(result).toEqual([]);
  });

  it('returns logs sorted newest-first', async () => {
    const older = makeEntry('a', '2026-01-01T10:00:00.000Z');
    const newer = makeEntry('b', '2026-01-02T10:00:00.000Z');
    const newest = makeEntry('c', '2026-01-03T10:00:00.000Z');

    const repo = makeMockAuditLogRepo({
      findByProjectId: jest.fn().mockResolvedValue([older, newest, newer]),
    });
    const uc = new GetAuditLogsByProjectUseCase(repo);

    const result = await uc.execute('proj-1');

    expect(result[0].id).toBe('c');
    expect(result[1].id).toBe('b');
    expect(result[2].id).toBe('a');
  });

  it('does not mutate the original array from the repository', async () => {
    const logs = [
      makeEntry('x', '2026-01-01T00:00:00.000Z'),
      makeEntry('y', '2026-01-03T00:00:00.000Z'),
    ];
    const repo = makeMockAuditLogRepo({ findByProjectId: jest.fn().mockResolvedValue(logs) });
    const uc = new GetAuditLogsByProjectUseCase(repo);

    const result = await uc.execute('proj-1');

    // Sorted result should be y, x (newest-first)
    expect(result[0].id).toBe('y');
    expect(result[1].id).toBe('x');
  });
});
