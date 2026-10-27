/** Why a card was refused, in our own words. */
export type DeclineReason = 'not-enough-funds' | 'card-expired' | 'other';

/** The answer to a card charge: accepted with the payment's reference, or refused with a reason. */
export type CardCharge =
  | { readonly outcome: 'accepted'; readonly reference: string }
  | { readonly outcome: 'refused'; readonly reason: DeclineReason };
