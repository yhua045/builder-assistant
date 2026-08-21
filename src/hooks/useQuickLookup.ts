export interface QuickLookupResult {
  id: string;
  name: string;
}

export function useQuickLookup() {
  return {
    quickAdd: async (): Promise<QuickLookupResult> => ({ id: 'dummy-id', name: 'Dummy' }),
    getSuggested: async (): Promise<QuickLookupResult[]> => [],
    selectContact: jest.fn(),
    lookupByLicense: async (): Promise<QuickLookupResult[]> => [],
    suggestedContacts: [],
    isLoadingSuggestions: false,
  };
}
