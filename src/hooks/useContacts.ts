import { useState, useCallback, useEffect, useMemo } from 'react';
import { container } from 'tsyringe';
import '../infrastructure/di/registerServices';
import { ContactRepository } from '../domain/repositories/ContactRepository';
import { Contact } from '../domain/entities/Contact';

export function useContacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);

  const contactRepository = useMemo(() => {
    try { return container.resolve<ContactRepository>('ContactRepository'); }
    catch { return null; }
  }, []);

  const loadContacts = useCallback(async () => {
    if (!contactRepository) return;
    setLoading(true);
    try {
      const items = await contactRepository.findAll();
      setContacts(items);
    } catch (e) {
      console.error('[useContacts] Failed to load contacts:', e);
    } finally {
      setLoading(false);
    }
  }, [contactRepository]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const search = useCallback(async (query: string) => {
    if (!contactRepository) return contacts;
    if (!query) return contacts;
    const q = query.toLowerCase();
    return contacts.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.trade ?? '').toLowerCase().includes(q),
    );
  }, [contactRepository, contacts]);

  return { contacts, loading, search, refresh: loadContacts };
}

export default useContacts;
