export const simulateNetwork = (value, delayMs = 120) => new Promise((resolve) => {
  globalThis.setTimeout(() => resolve(value), delayMs);
});

export const isPointInBounds = (point, bounds) => {
  if (!bounds) return true;
  const { north, south, east, west } = bounds;
  return point.lat <= north && point.lat >= south && point.lng <= east && point.lng >= west;
};
