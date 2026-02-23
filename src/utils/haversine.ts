/**
 * Pure Haversine great-circle distance.
 *
 * @returns Distance in metres between two WGS-84 coordinate pairs.
 */
const EARTH_RADIUS_M = 6_371_000;

export function haversineMeters(
  latA: number,
  lonA: number,
  latB: number,
  lonB: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(latB - latA);
  const dLon = toRad(lonB - lonA);
  const rLatA = toRad(latA);
  const rLatB = toRad(latB);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rLatA) * Math.cos(rLatB) * Math.sin(dLon / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
