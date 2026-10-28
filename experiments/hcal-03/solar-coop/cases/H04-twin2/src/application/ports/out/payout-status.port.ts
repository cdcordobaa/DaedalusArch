export type PayoutStatus = 'pending' | 'paid' | 'failed';

export interface PayoutStatusLookup {
  lookup(reference: string): Promise<PayoutStatus>;
}
