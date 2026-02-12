import { useState } from 'react';

// Minimal hook stub that returns a simple in-memory list and a search API.
export function useContacts() {
  const [contacts] = useState(() => [
    { id: '1', name: 'Alex Johnson', title: 'Owner' },
    { id: '2', name: 'Taylor Smith', title: 'Manager' },
    { id: '3', name: 'Jordan Lee', title: 'Contractor' },
  ]);

  const search = async (query: string) => {
    if (!query) return contacts;
    const q = query.toLowerCase();
    return contacts.filter((c) => c.name.toLowerCase().includes(q) || (c.title || '').toLowerCase().includes(q));
  };

  return { contacts, search };
}

export default useContacts;
