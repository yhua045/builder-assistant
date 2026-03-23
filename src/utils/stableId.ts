/**
 * stableId — deterministic task-ID generator for critical-path suggestions.
 *
 * Produces a stable, human-readable ID that is identical across retries for
 * the same (projectId, suggestionId) pair. Uses FNV-1a 32-bit hash — a
 * non-cryptographic hash entirely free of external dependencies.
 *
 * Collision probability is negligible for realistic critical-path counts
 * (< 30 suggestions per project): two distinct inputs have a ~1-in-4-billion
 * chance of producing the same hash segment.
 */
export function stableId(projectId: string, suggestionId: string): string {
  const raw = `cp:${projectId}:${suggestionId}`;

  // FNV-1a 32-bit hash
  let h = 0x811c9dc5;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }

  const hex = h.toString(16).padStart(8, '0');
  return `cp-${hex}-${projectId.slice(0, 8)}-${suggestionId.slice(0, 8)}`;
}
