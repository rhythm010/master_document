// Shared geographic calculation utilities.

/**
 * Calculate distance between two GPS points (lat/lon degrees) in meters using the Haversine formula.
 */
export function calculateDistanceMeters(input: {
  lat1: number;
  lon1: number;
  lat2: number;
  lon2: number;
}) {
  const earthRadiusMeters = 6_371_000;
  const lat1Rad = toRadians(input.lat1);
  const lat2Rad = toRadians(input.lat2);
  const deltaLat = toRadians(input.lat2 - input.lat1);
  const deltaLon = toRadians(input.lon2 - input.lon1);

  const sinLat = Math.sin(deltaLat / 2);
  const sinLon = Math.sin(deltaLon / 2);
  const a = sinLat * sinLat + Math.cos(lat1Rad) * Math.cos(lat2Rad) * sinLon * sinLon;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMeters * c;
}

// Convert degrees to radians.
function toRadians(value: number) {
  return (value * Math.PI) / 180;
}
