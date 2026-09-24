/** Collision-safe local id (Date.now() alone repeats within the same millisecond). */
export const createId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
