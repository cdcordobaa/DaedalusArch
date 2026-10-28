import type { Donation } from '../../../domain/donation';

export interface DonationRepository {
  save(donation: Donation): Promise<void>;
}
