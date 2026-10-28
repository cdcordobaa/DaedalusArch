export type RoyaltyStanding = 'cleared' | 'refused' | 'under-review';

export function isSettled(standing: RoyaltyStanding): boolean {
  return standing === 'cleared' || standing === 'refused';
}
