export const BUCKET_COUNT = 200;

/** Numeric part of the id, modulo bucketCount. */
export function bucketOf(id: string, bucketCount: number = BUCKET_COUNT): number {
  const digits = id.replace(/\D/g, '');
  return Number(digits) % bucketCount;
}

/** Two-letter a-z shard key, right-padded with '_'. */
export function shardKey(name: string): string {
  const letters = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z]/g, '')
    .slice(0, 2);
  return letters.padEnd(2, '_');
}
