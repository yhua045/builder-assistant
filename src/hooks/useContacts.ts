import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { container } from 'tsyringe';
import '../infrastructure/di/registerServices';
import { ContactRepository } from '../domain/repositories/ContactRepository';
import { Contact } from '../domain/entities/Contact';
import { queryKeys } from './queryKeys';

export function useContacts() {
  const contactRepository = useMemo(() => {
    try { return container.resolve<ContactRepository>('ContactRepository'); }
    catch { return null; }
  }, []);

  const {
    data: contacts = [],
    isLoading: loading,
    refetch,
  } = useQuery<Contact[]>({
    queryKey: queryKeys.contacts(),
    queryFn: async () => {
      if (!contactRepository) return [];
      return contactRepository.findAll();
    },
    staleTime: 5 * 60_000, // contacts change rarely on mobile
  });

  const search = useCallback(async (query: string) => {
    if (!query) return contacts;
    const q = query.toLowerCase();
    return contacts.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.trade ?? '').toLowerCase().includes(q),
    );
  }, [contacts]);

  return { contacts, loading, search, refresh: async () => { await refetch(); } };
}

export default useContacts;
