/**
 * Shared test utilities for hooks that use TanStack Query.
 *
 * Usage:
 *   import { renderHookWithQuery, wrapWithQuery } from '../utils/queryClientWrapper';
 *
 *   const { result } = renderHookWithQuery(() => useMyHook());
 *   // or with renderer.create:
 *   renderer.create(wrapWithQuery(<MyComponent />));
 */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react-native';

/** Creates a fresh QueryClient suitable for tests (no retries, no caching). */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/** Wraps a React element with a fresh QueryClientProvider. */
export function wrapWithQuery(
  element: React.ReactElement,
  qc?: QueryClient,
): React.ReactElement {
  const queryClient = qc ?? createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>{element}</QueryClientProvider>
  );
}

/** renderHook with a fresh QueryClientProvider wrapper. */
export function renderHookWithQuery<T>(
  hook: () => T,
  qc?: QueryClient,
): ReturnType<typeof renderHook> & { queryClient: QueryClient } {
  const queryClient = qc ?? createTestQueryClient();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const result = renderHook(hook, { wrapper });
  return { ...result, queryClient };
}
