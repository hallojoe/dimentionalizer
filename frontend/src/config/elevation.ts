/** Scene units, relative to the origin (groups) or the group plane (objects). */
export const MAX_ELEVATION = 10_000;

export function validateElevation(value: unknown, path = 'Elevation'): number {
  if (value === undefined) return 0;
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > MAX_ELEVATION) {
    throw Error(`${path} must be a number between -${MAX_ELEVATION} and ${MAX_ELEVATION}.`);
  }
  return value;
}
