/** Why a deposit could not be held, in the library's own terms. */
export type HoldRefusal = 'over-limit' | 'card-problem';

/** One vendor-looking word with the library's own: not the vendor's set. */
export type HoldCheck = 'limit_exceeded' | 'manual-check';

export enum DepositState { Held = 'held', Refused = 'refused' }

export const CONDITIONS = ['good', 'worn', 'broken'] as const;
