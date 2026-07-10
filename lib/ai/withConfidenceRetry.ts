// Model-reported confidence isn't ground truth, so we always take two
// independent samples and keep whichever one scored higher, rather than
// gating the second attempt on the first missing a threshold.
export async function withConfidenceRetry<T extends { confidence: number }>(
  attempt: () => Promise<T>
): Promise<T> {
  const [first, second] = await Promise.all([attempt(), attempt()]);
  return second.confidence >= first.confidence ? second : first;
}
