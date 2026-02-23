import { haversineMeters } from '../../src/utils/haversine';

describe('haversineMeters', () => {
  it('returns 0 for the same point', () => {
    expect(haversineMeters(-33.8688, 151.2093, -33.8688, 151.2093)).toBe(0);
  });

  it('computes approximately 1 km for ~0.009 degree latitude shift from Sydney CBD', () => {
    // Sydney CBD: -33.8688, 151.2093
    // ~1 km north: -33.8598, 151.2093 (Δlat ≈ 0.009°)
    const d = haversineMeters(-33.8688, 151.2093, -33.8598, 151.2093);
    expect(d).toBeGreaterThan(900);
    expect(d).toBeLessThan(1100);
  });

  it('computes approximately 1 km for ~0.011 degree longitude shift at Sydney latitude', () => {
    // At lat -34, 1° lon ≈ 92.6 km, so 0.011° ≈ 1.02 km
    const d = haversineMeters(-33.8688, 151.2093, -33.8688, 151.2203);
    expect(d).toBeGreaterThan(900);
    expect(d).toBeLessThan(1200);
  });

  it('returns approximately half the Earth circumference for antipodal points', () => {
    // Earth circumference ≈ 40_030 km → half ≈ 20_015 km
    const d = haversineMeters(0, 0, 0, 180);
    expect(d).toBeGreaterThan(20_000_000);
    expect(d).toBeLessThan(20_030_000);
  });

  it('is symmetric — d(A,B) === d(B,A)', () => {
    const d1 = haversineMeters(-33.8688, 151.2093, -27.4698, 153.0251);
    const d2 = haversineMeters(-27.4698, 153.0251, -33.8688, 151.2093);
    expect(d1).toBeCloseTo(d2, 0);
  });
});
