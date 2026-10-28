const RETRYABLE_STATUSES: ReadonlySet<string> = new Set(['PENDING_REVIEW', 'DECLINED_ISSUER_UNAVAILABLE']);

export function shouldRetry(outcome: string): boolean {
  return RETRYABLE_STATUSES.has(outcome);
}
