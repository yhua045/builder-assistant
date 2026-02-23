import { GetNearbyProjectsUseCase, NetworkStatusProvider } from '../../src/application/usecases/location/GetNearbyProjectsUseCase';
import { ILocationService, PropertyMatch } from '../../src/application/services/ILocationService';

// ─── helpers ───────────────────────────────────────────────────────────────

function makeMatch(projectId: string, distanceMeters: number, rankingScore: number): PropertyMatch {
  return {
    projectId,
    address: `${projectId} St`,
    latitude: -33.86,
    longitude: 151.21,
    distanceMeters,
    rankingScore,
  };
}

function mockAdapter(matches: PropertyMatch[], shouldThrow = false): ILocationService {
  return {
    findNearbyProjects: jest.fn(async () => {
      if (shouldThrow) throw new Error('remote_error');
      return matches;
    }),
  };
}

function mockNetwork(online: boolean): NetworkStatusProvider {
  return { isOnline: () => online };
}

// ─── tests ─────────────────────────────────────────────────────────────────

describe('GetNearbyProjectsUseCase', () => {
  const LAT = -33.8688;
  const LON = 151.2093;

  it('returns local results when offline', async () => {
    const localMatches = [makeMatch('p1', 100, 0.9), makeMatch('p2', 500, 0.7)];
    const uc = new GetNearbyProjectsUseCase(
      mockAdapter(localMatches),
      mockAdapter([]),
      mockNetwork(false),
    );
    const result = await uc.execute(LAT, LON);
    expect(result).toEqual(localMatches);
  });

  it('delegates to remote adapter when online and remoteEnabled is true', async () => {
    const remoteMatches = [makeMatch('p3', 200, 0.85)];
    const uc = new GetNearbyProjectsUseCase(
      mockAdapter([]),
      mockAdapter(remoteMatches),
      mockNetwork(true),
      /* remoteEnabled */ true,
    );
    const result = await uc.execute(LAT, LON);
    expect(result).toEqual(remoteMatches);
  });

  it('falls back to local when remote throws (remoteEnabled is true)', async () => {
    const localMatches = [makeMatch('p4', 300, 0.75)];
    const uc = new GetNearbyProjectsUseCase(
      mockAdapter(localMatches),
      mockAdapter([], /* shouldThrow */ true),
      mockNetwork(true),
      /* remoteEnabled */ true,
    );
    const result = await uc.execute(LAT, LON);
    expect(result).toEqual(localMatches);
  });

  it('applies maxResults cap', async () => {
    const many = Array.from({ length: 15 }, (_, i) =>
      makeMatch(`p${i}`, (i + 1) * 100, 1 - i * 0.05),
    );
    const uc = new GetNearbyProjectsUseCase(
      mockAdapter(many),
      mockAdapter([]),
      mockNetwork(false),
    );
    const result = await uc.execute(LAT, LON, { maxResults: 5 });
    expect(result).toHaveLength(5);
  });

  it('applies minConfidence filter', async () => {
    const mixed = [
      makeMatch('high', 100, 0.8),
      makeMatch('low', 200, 0.3),
      makeMatch('mid', 300, 0.55),
    ];
    const uc = new GetNearbyProjectsUseCase(
      mockAdapter(mixed),
      mockAdapter([]),
      mockNetwork(false),
    );
    const result = await uc.execute(LAT, LON, { minConfidence: 0.5 });
    expect(result.map((r) => r.projectId)).toEqual(['high', 'mid']);
  });

  it('returns empty array when adapter returns no properties', async () => {
    const uc = new GetNearbyProjectsUseCase(
      mockAdapter([]),
      mockAdapter([]),
      mockNetwork(false),
    );
    const result = await uc.execute(LAT, LON);
    expect(result).toEqual([]);
  });

  it('passes opts through to the adapter', async () => {
    const localAdapter = mockAdapter([]);
    const uc = new GetNearbyProjectsUseCase(
      localAdapter,
      mockAdapter([]),
      mockNetwork(false),
    );
    await uc.execute(LAT, LON, { radiusKm: 3, maxResults: 7 });
    expect(localAdapter.findNearbyProjects).toHaveBeenCalledWith(
      LAT,
      LON,
      expect.objectContaining({ radiusKm: 3 }),
    );
  });

  describe('remoteEnabled feature flag', () => {
    it('uses local directly when remoteEnabled is false (default), even if online', async () => {
      const localMatches = [makeMatch('p-local', 100, 0.9)];
      const remoteAdapter = mockAdapter([makeMatch('p-remote', 50, 0.95)]);
      const uc = new GetNearbyProjectsUseCase(
        mockAdapter(localMatches),
        remoteAdapter,
        mockNetwork(true),
        /* remoteEnabled */ false,
      );
      const result = await uc.execute(LAT, LON);
      expect(result).toEqual(localMatches);
      expect(remoteAdapter.findNearbyProjects).not.toHaveBeenCalled();
    });

    it('does not invoke remote when flag is false, regardless of network', async () => {
      const remoteAdapter = mockAdapter([]);
      const uc = new GetNearbyProjectsUseCase(
        mockAdapter([]),
        remoteAdapter,
        mockNetwork(true),
        false,
      );
      await uc.execute(LAT, LON);
      expect(remoteAdapter.findNearbyProjects).not.toHaveBeenCalled();
    });

    it('calls remote when remoteEnabled is true and online', async () => {
      const remoteMatches = [makeMatch('p-remote', 100, 0.9)];
      const remoteAdapter = mockAdapter(remoteMatches);
      const uc = new GetNearbyProjectsUseCase(
        mockAdapter([]),
        remoteAdapter,
        mockNetwork(true),
        /* remoteEnabled */ true,
      );
      const result = await uc.execute(LAT, LON);
      expect(result).toEqual(remoteMatches);
      expect(remoteAdapter.findNearbyProjects).toHaveBeenCalledTimes(1);
    });

    it('falls back to local when remoteEnabled is true but network is offline', async () => {
      const localMatches = [makeMatch('p-local', 200, 0.8)];
      const remoteAdapter = mockAdapter([makeMatch('p-remote', 100, 0.9)]);
      const uc = new GetNearbyProjectsUseCase(
        mockAdapter(localMatches),
        remoteAdapter,
        mockNetwork(false),
        true,
      );
      const result = await uc.execute(LAT, LON);
      expect(result).toEqual(localMatches);
      expect(remoteAdapter.findNearbyProjects).not.toHaveBeenCalled();
    });
  });
});
