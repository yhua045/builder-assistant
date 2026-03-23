/**
 * Unit tests for stableId utility
 * Asserts deterministic task ID generation for critical-path suggestions.
 */

// The utility doesn't exist yet — tests will fail (RED phase).
import { stableId } from '../../src/utils/stableId';

describe('stableId', () => {
  it('returns a non-empty string', () => {
    const result = stableId('proj-1', 'cp-01');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('is stable — same args produce the same output', () => {
    const first = stableId('proj-abc', 'cp-NSW-01');
    const second = stableId('proj-abc', 'cp-NSW-01');
    expect(first).toBe(second);
  });

  it('different suggestionId produces a different result', () => {
    const a = stableId('proj-1', 'cp-01');
    const b = stableId('proj-1', 'cp-02');
    expect(a).not.toBe(b);
  });

  it('different projectId produces a different result', () => {
    const a = stableId('proj-aaa', 'cp-01');
    const b = stableId('proj-bbb', 'cp-01');
    expect(a).not.toBe(b);
  });

  it('starts with "cp-" prefix', () => {
    const result = stableId('proj-1', 'cp-01');
    expect(result.startsWith('cp-')).toBe(true);
  });
});
