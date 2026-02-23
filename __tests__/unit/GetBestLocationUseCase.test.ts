import { GetBestLocationUseCase } from '../../src/application/usecases/location/GetBestLocationUseCase';
import { MockStoredLocationRepository } from '../../src/infrastructure/location/MockStoredLocationRepository';
import { GeoLocation } from '../../src/application/services/IGpsService';

function makeLoc(deltaMs = 0, accuracy = 10): GeoLocation {
  return {
    latitude: 1.23,
    longitude: 4.56,
    accuracyMeters: accuracy,
    timestamp: new Date(Date.now() - deltaMs).toISOString(),
  };
}

test('returns cached when maxAgeMs set and cache is fresh', async () => {
  const cached = makeLoc(1000);
  const stored = new MockStoredLocationRepository(cached);
  const device = { getCurrentLocation: async () => { throw new Error('should not be called'); } };
  const uc = new GetBestLocationUseCase(device, stored);

  const res = await uc.getBestLocation({ maxAgeMs: 60_000 });
  expect(res).toEqual(cached);
});

test('returns device fix when accuracy acceptable and persists it', async () => {
  const old = makeLoc(1000 * 60 * 60, 50);
  const stored = new MockStoredLocationRepository(old);
  const newFix = makeLoc(0, 5);
  const device = { getCurrentLocation: async () => newFix };
  const uc = new GetBestLocationUseCase(device, stored);

  const res = await uc.getBestLocation({ timeoutMs: 2000, requiredAccuracyMeters: 10 });
  expect(res).toEqual(newFix);
  const persisted = await stored.getLastKnown();
  expect(persisted).toEqual(newFix);
});

test('falls back to persisted when device returns null', async () => {
  const old = makeLoc(1000 * 60 * 5, 20);
  const stored = new MockStoredLocationRepository(old);
  const device = { getCurrentLocation: async () => null };
  const uc = new GetBestLocationUseCase(device, stored);

  const res = await uc.getBestLocation({ timeoutMs: 1000 });
  expect(res).toEqual(old);
});

test('falls back when device throws permission error', async () => {
  const old = makeLoc(1000 * 60 * 5, 20);
  const stored = new MockStoredLocationRepository(old);
  const device = { getCurrentLocation: async () => { throw new Error('permission_denied'); } };
  const uc = new GetBestLocationUseCase(device, stored);

  const res = await uc.getBestLocation();
  expect(res).toEqual(old);
});
