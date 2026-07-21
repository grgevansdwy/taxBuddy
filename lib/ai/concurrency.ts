// Bounded-concurrency map — avoids hammering Bedrock with N simultaneous
// requests (which returns HTTP 429). Preserves input order. Used for the
// per-page fan-out on long consolidated 1099s, where an unbounded
// Promise.all(pages.map(...)) throttled every model in testing
// (NOVA_PRO_MIGRATION.md §4.4).
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let idx = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (idx < items.length) {
        const i = idx++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}
