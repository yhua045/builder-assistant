import { useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { container } from 'tsyringe';
import '../infrastructure/di/registerServices';
import { ContactRepository } from '../domain/repositories/ContactRepository';
import { ILookupProvider } from '../domain/services/ILookupProvider';
import { QuickAddContactUseCase, QuickAddContactInput } from '../application/usecases/contact/QuickAddContactUseCase';
import { LookupProviderSearchUseCase } from '../application/usecases/contact/LookupProviderSearchUseCase';
import { GetSuggestedContractorsUseCase } from '../application/usecases/contact/GetSuggestedContractorsUseCase';
import { Contact } from '../domain/entities/Contact';
import { queryKeys } from './queryKeys';
import { FeatureFlags } from '../infrastructure/config/featureFlags';

export function useQuickLookup(onChange?: (id: string) => void) {
  const queryClient = useQueryClient();

  const contactRepository = useMemo(() => {
    try { return container.resolve<ContactRepository>('ContactRepository'); }
    catch { return null; }
  }, []);

  const lookupProvider = useMemo(() => {
    try { return container.resolve<ILookupProvider>('LookupProvider'); }
    catch { return null; }
  }, []);

  const quickAdd = useCallback(async (input: QuickAddContactInput): Promise<Contact> => {
    if (!contactRepository) throw new Error('ContactRepository not available');
    const useCase = new QuickAddContactUseCase(contactRepository);
    const contact = await useCase.execute(input);
    await queryClient.invalidateQueries({ queryKey: queryKeys.contacts() });
    return contact;
  }, [contactRepository, queryClient]);

  const lookupByLicense = useCallback(async (query: string) => {
    if (!FeatureFlags.externalLookup) return [];
    if (!lookupProvider) return [];
    const useCase = new LookupProviderSearchUseCase(lookupProvider);
    return useCase.execute({ query });
  }, [lookupProvider]);

  const getSuggested = useCallback(async (limit = 10): Promise<Contact[]> => {
    if (!contactRepository) return [];
    const useCase = new GetSuggestedContractorsUseCase(contactRepository);
    return useCase.execute({ limit });
  }, [contactRepository]);

  const selectContact = useCallback(async (id: string) => {
    if (contactRepository) {
      try {
        await contactRepository.incrementUsageCount(id);
        await queryClient.invalidateQueries({ queryKey: queryKeys.contacts() });
      } catch {
        // non-fatal: usage tracking should not block UI
      }
    }
    onChange?.(id);
  }, [contactRepository, queryClient, onChange]);

  return { quickAdd, lookupByLicense, getSuggested, selectContact };
}
