import { LocalSqliteProjectRepository } from '../../src/infrastructure/repositories/LocalSqliteProjectRepository';

describe('ProjectRepository contract (interface)', () => {
  it('should expose the expected repository methods (contract)', async () => {
    const repo: any = new LocalSqliteProjectRepository();

    // Methods expected per domain contract
    const expectedMethods = [
      'create',
      'save',
      'findById',
      'findByExternalId',
      'list',
      'count',
      'findByStatus',
      'findByPropertyId',
      'findByOwnerId',
      'findByPhaseDateRange',
      'findWithUpcomingPhases',
      'update',
      'delete',
      'withTransaction'
    ];

    const missing = expectedMethods.filter(m => typeof repo[m] !== 'function');

    // This test intentionally fails until the infrastructure adapter implements the full contract.
    expect(missing).toEqual([]);
  });
});
