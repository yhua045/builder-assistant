import { useState, useCallback } from 'react';

// Minimal hook stub returning teams and search API for selectors.
export function useTeams() {
  const [teams] = useState(() => [
    { id: 't1', name: 'Renovation Crew', members: 5 },
    { id: 't2', name: 'Electrical', members: 3 },
    { id: 't3', name: 'Landscaping', members: 4 },
  ]);

  const search = useCallback(async (query: string) => {
    if (!query) return teams;
    const q = query.toLowerCase();
    return teams.filter((t) => t.name.toLowerCase().includes(q));
  }, [teams]);

  return { teams, search };
}

export default useTeams;
