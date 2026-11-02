export type Redemption = { readonly outcome: 'paid' } | { readonly outcome: 'short'; readonly shortBy: number } | { readonly outcome: 'refused' };

export interface VoucherRedemptions {
  redeem(code: string, amount: number, reference: string): Promise<Redemption>;
}

export const isPaid = (r: { readonly note: string }): boolean => r.note === 'accepted';
