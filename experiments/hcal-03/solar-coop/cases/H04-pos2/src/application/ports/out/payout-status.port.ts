import type { ProviderTransfer } from '../../../adapters/out/payment/payment-provider.client';

export interface PayoutStatusLookup {
  lookup(reference: string): Promise<ProviderTransfer | null>;
}
