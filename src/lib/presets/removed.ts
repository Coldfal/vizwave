export const REMOVED_PRESET_IDS = [
  "neon-pulse",
  "aurora-streams",
  "sonic-spiral",
  "mandala-bloom",
  "crystal-lattice",
  "infinite-descent",
] as const;

export function isRemovedPreset(id: string | null | undefined): boolean {
  if (!id) return false;
  return (REMOVED_PRESET_IDS as readonly string[]).includes(id);
}
