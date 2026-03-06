import { ResolveDelayReasonUseCase } from '../../src/application/usecases/task/ResolveDelayReasonUseCase';
import { TaskRepository } from '../../src/domain/repositories/TaskRepository';

function makeMockRepo(overrides: Partial<TaskRepository> = {}): TaskRepository {
  return {
    save: jest.fn(),
    findById: jest.fn().mockResolvedValue(null),
    findAll: jest.fn().mockResolvedValue([]),
    findByProjectId: jest.fn().mockResolvedValue([]),
    findAdHoc: jest.fn().mockResolvedValue([]),
    findUpcoming: jest.fn().mockResolvedValue([]),
    update: jest.fn(),
    delete: jest.fn(),
    addDependency: jest.fn(),
    removeDependency: jest.fn(),
    findDependencies: jest.fn().mockResolvedValue([]),
    findDependents: jest.fn().mockResolvedValue([]),
    addDelayReason: jest.fn(),
    removeDelayReason: jest.fn(),
    resolveDelayReason: jest.fn().mockResolvedValue(undefined),
    findDelayReasons: jest.fn().mockResolvedValue([]),
    summarizeDelayReasons: jest.fn().mockResolvedValue([]),
    deleteDependenciesByTaskId: jest.fn().mockResolvedValue(undefined),
    deleteDelayReasonsByTaskId: jest.fn().mockResolvedValue(undefined),
    findProgressLogs: jest.fn().mockResolvedValue([]),
    addProgressLog: jest.fn(),
    findAllDependencies: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe('ResolveDelayReasonUseCase', () => {
  it('calls resolveDelayReason with the provided id and timestamp', async () => {
    const repo = makeMockRepo();
    const uc = new ResolveDelayReasonUseCase(repo);
    const ts = '2026-03-03T12:00:00.000Z';

    await uc.execute({ delayReasonId: 'delay-1', resolvedAt: ts });

    expect(repo.resolveDelayReason).toHaveBeenCalledWith('delay-1', ts, undefined);
  });

  it('defaults resolvedAt to now when not provided', async () => {
    const before = Date.now();
    const repo = makeMockRepo();
    const uc = new ResolveDelayReasonUseCase(repo);

    await uc.execute({ delayReasonId: 'delay-2' });

    const [, calledTs] = (repo.resolveDelayReason as jest.Mock).mock.calls[0];
    const calledMs = new Date(calledTs).getTime();
    expect(calledMs).toBeGreaterThanOrEqual(before);
    expect(calledMs).toBeLessThanOrEqual(Date.now() + 50);
  });

  it('passes mitigationNotes through', async () => {
    const repo = makeMockRepo();
    const uc = new ResolveDelayReasonUseCase(repo);

    await uc.execute({ delayReasonId: 'delay-3', mitigationNotes: 'Ordered from backup supplier' });

    expect(repo.resolveDelayReason).toHaveBeenCalledWith(
      'delay-3',
      expect.any(String),
      'Ordered from backup supplier',
    );
  });
});
