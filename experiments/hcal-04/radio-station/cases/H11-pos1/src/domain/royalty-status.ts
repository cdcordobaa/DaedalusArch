export type RoyaltyStatus = 'ACCEPTED' | 'REJECTED_DUPLICATE' | 'REJECTED_UNLICENSED' | 'PENDING_REVIEW';

export function isSettled(status: RoyaltyStatus): boolean {
  return status === 'ACCEPTED' || status === 'REJECTED_DUPLICATE';
}
