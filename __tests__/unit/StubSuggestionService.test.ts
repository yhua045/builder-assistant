/**
 * Unit tests for StubSuggestionService
 * (src/infrastructure/ai/suggestionService.ts)
 *
 * TDD — green immediately since the class is a stub, but tests lock-in
 * the contract: getSuggestion() always resolves to null regardless of input.
 */
import {
  StubSuggestionService,
  type SuggestionContext,
} from '../../src/infrastructure/ai/suggestionService';

const makeCtx = (overrides: Partial<SuggestionContext> = {}): SuggestionContext => ({
  taskId: 'task-1',
  description: 'Install waterproofing membrane',
  photos: [],
  siteConstraints: undefined,
  projectLocation: undefined,
  fireZone: undefined,
  regulatoryFlags: undefined,
  ...overrides,
});

describe('StubSuggestionService', () => {
  let service: StubSuggestionService;

  beforeEach(() => {
    service = new StubSuggestionService();
  });

  it('returns null for a minimal context', async () => {
    const result = await service.getSuggestion({ taskId: 'task-1', photos: [] });
    expect(result).toBeNull();
  });

  it('returns null when photos are provided', async () => {
    const ctx = makeCtx({ photos: ['file:///photo1.jpg', 'https://cdn.example.com/photo2.jpg'] });
    const result = await service.getSuggestion(ctx);
    expect(result).toBeNull();
  });

  it('returns null when full project context is provided', async () => {
    const ctx = makeCtx({
      siteConstraints: 'Access via rear lane only',
      projectLocation: '-33.8688, 151.2093',
      fireZone: 'BAL-29',
      regulatoryFlags: ['Heritage Overlay', 'Flood Zone'],
    });
    const result = await service.getSuggestion(ctx);
    expect(result).toBeNull();
  });

  it('resolves synchronously (no I/O)', async () => {
    // Verify the promise resolves in the same microtask tick
    let resolved = false;
    service.getSuggestion(makeCtx()).then(() => { resolved = true; });
    await Promise.resolve(); // one microtask
    expect(resolved).toBe(true);
  });
});
