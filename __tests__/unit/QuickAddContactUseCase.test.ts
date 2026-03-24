import { QuickAddContactUseCase } from '../../src/application/usecases/contact/QuickAddContactUseCase';
import { ContactRepository } from '../../src/domain/repositories/ContactRepository';
import { Contact } from '../../src/domain/entities/Contact';

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

describe('QuickAddContactUseCase', () => {
  it('throws if name is empty', async () => {
    const repo = makeMockRepo();
    const useCase = new QuickAddContactUseCase(repo);
    await expect(useCase.execute({ name: '' })).rejects.toThrow('name');
  });

  it('throws if name is whitespace only', async () => {
    const repo = makeMockRepo();
    const useCase = new QuickAddContactUseCase(repo);
    await expect(useCase.execute({ name: '   ' })).rejects.toThrow('name');
  });

  it('calls repo.save with a Contact including name', async () => {
    const repo = makeMockRepo();
    const useCase = new QuickAddContactUseCase(repo);
    const saved = await useCase.execute({ name: 'Alice Builder' });
    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ name: 'Alice Builder' }));
    expect(saved.name).toBe('Alice Builder');
    expect(saved.id).toBeTruthy();
  });

  it('includes optional fields when provided', async () => {
    const repo = makeMockRepo();
    const useCase = new QuickAddContactUseCase(repo);
    const saved = await useCase.execute({
      name: 'Bob Plumber',
      trade: 'Plumbing',
      licenseNumber: 'LIC-12345',
      phone: '0400000000',
    });
    expect(saved.trade).toBe('Plumbing');
    expect(saved.licenseNumber).toBe('LIC-12345');
    expect(saved.phone).toBe('0400000000');
  });

  it('rejects if licenseNumber has invalid format (non-alphanumeric dash)', async () => {
    const repo = makeMockRepo();
    const useCase = new QuickAddContactUseCase(repo);
    await expect(
      useCase.execute({ name: 'Dave', licenseNumber: 'invalid license!' }),
    ).rejects.toThrow('licenseNumber');
  });

  it('accepts licenseNumber with alphanumeric and dashes', async () => {
    const repo = makeMockRepo();
    const useCase = new QuickAddContactUseCase(repo);
    const saved = await useCase.execute({ name: 'Eve', licenseNumber: 'VBA-98765' });
    expect(saved.licenseNumber).toBe('VBA-98765');
  });
});
