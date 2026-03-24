import { LookupProviderSearchUseCase, LookupUnavailableError } from '../../src/application/usecases/contact/LookupProviderSearchUseCase';
import { ILookupProvider, LookupResult } from '../../src/domain/services/ILookupProvider';

const mockResult: LookupResult = {
  licenseNumber: 'VBA-001',
  name: 'Test Builder Co',
  trade: 'Electrical',
  source: 'VBA',
};

describe('LookupProviderSearchUseCase', () => {
  it('throws LookupUnavailableError when provider is not available', async () => {
    const provider: ILookupProvider = {
      isAvailable: () => false,
      search: jest.fn(),
    };
    const useCase = new LookupProviderSearchUseCase(provider);
    await expect(useCase.execute({ query: 'builder' })).rejects.toBeInstanceOf(LookupUnavailableError);
  });

  it('returns results from available provider', async () => {
    const provider: ILookupProvider = {
      isAvailable: () => true,
      search: jest.fn().mockResolvedValue([mockResult]),
    };
    const useCase = new LookupProviderSearchUseCase(provider);
    const results = await useCase.execute({ query: 'builder' });
    expect(results).toHaveLength(1);
    expect(results[0].licenseNumber).toBe('VBA-001');
  });

  it('passes the query to the provider', async () => {
    const mockSearch = jest.fn().mockResolvedValue([]);
    const provider: ILookupProvider = {
      isAvailable: () => true,
      search: mockSearch,
    };
    const useCase = new LookupProviderSearchUseCase(provider);
    await useCase.execute({ query: 'plumber' });
    expect(mockSearch).toHaveBeenCalledWith('plumber');
  });

  it('throws LookupUnavailableError on timeout (timeoutMs exceeded)', async () => {
    const provider: ILookupProvider = {
      isAvailable: () => true,
      search: jest.fn().mockImplementation(
        () => new Promise<LookupResult[]>((resolve) => setTimeout(() => resolve([]), 500)),
      ),
    };
    const useCase = new LookupProviderSearchUseCase(provider);
    await expect(useCase.execute({ query: 'test', timeoutMs: 50 })).rejects.toBeInstanceOf(LookupUnavailableError);
  });
});
