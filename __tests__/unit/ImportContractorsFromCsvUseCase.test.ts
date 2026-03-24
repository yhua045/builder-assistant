import { ImportContractorsFromCsvUseCase } from '../../src/application/usecases/contact/ImportContractorsFromCsvUseCase';
import { ContactRepository } from '../../src/domain/repositories/ContactRepository';

const makeMockRepo = (): jest.Mocked<ContactRepository> => ({
  save: jest.fn().mockResolvedValue(undefined),
  findById: jest.fn().mockResolvedValue(null),
  findAll: jest.fn().mockResolvedValue([]),
  findByRole: jest.fn().mockResolvedValue([]),
  findByName: jest.fn().mockResolvedValue([]),
  update: jest.fn().mockResolvedValue(undefined),
  delete: jest.fn().mockResolvedValue(undefined),
  incrementUsageCount: jest.fn().mockResolvedValue(undefined),
  findMostUsed: jest.fn().mockResolvedValue([]),
});

const CSV_VALID = `name,trade,licenseNumber,phone
Alice Builder,Electrical,VBA-001,0400111111
Bob Plumber,Plumbing,VBA-002,0400222222`;

const CSV_MISSING_NAME = `name,trade,licenseNumber,phone
,Electrical,VBA-003,0400333333`;

const CSV_NO_NAME_COLUMN = `trade,licenseNumber,phone
Alice,Electrical,VBA-001`;

describe('ImportContractorsFromCsvUseCase', () => {
  it('imports valid rows and returns correct summary', async () => {
    const repo = makeMockRepo();
    const useCase = new ImportContractorsFromCsvUseCase(repo);
    const summary = await useCase.execute(CSV_VALID);
    expect(summary.totalRows).toBe(2);
    expect(summary.imported).toBe(2);
    expect(summary.errors).toHaveLength(0);
    expect(repo.save).toHaveBeenCalledTimes(2);
  });

  it('reports row-level errors for missing name values', async () => {
    const repo = makeMockRepo();
    const useCase = new ImportContractorsFromCsvUseCase(repo);
    const summary = await useCase.execute(CSV_MISSING_NAME);
    expect(summary.totalRows).toBe(1);
    expect(summary.imported).toBe(0);
    expect(summary.errors).toHaveLength(1);
    expect(summary.errors[0].row).toBe(2);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('rejects CSV missing the required name header', async () => {
    const repo = makeMockRepo();
    const useCase = new ImportContractorsFromCsvUseCase(repo);
    await expect(useCase.execute(CSV_NO_NAME_COLUMN)).rejects.toThrow('name');
  });

  it('handles empty CSV gracefully', async () => {
    const repo = makeMockRepo();
    const useCase = new ImportContractorsFromCsvUseCase(repo);
    const summary = await useCase.execute('name,trade\n');
    expect(summary.totalRows).toBe(0);
    expect(summary.imported).toBe(0);
    expect(summary.errors).toHaveLength(0);
  });

  it('only saves valid rows when mixed CSV provided', async () => {
    const repo = makeMockRepo();
    const useCase = new ImportContractorsFromCsvUseCase(repo);
    const mixed = `name,trade\nAlice,Electrical\n,Plumbing\nBob,Carpentry`;
    const summary = await useCase.execute(mixed);
    expect(summary.totalRows).toBe(3);
    expect(summary.imported).toBe(2);
    expect(summary.errors).toHaveLength(1);
    expect(repo.save).toHaveBeenCalledTimes(2);
  });
});
