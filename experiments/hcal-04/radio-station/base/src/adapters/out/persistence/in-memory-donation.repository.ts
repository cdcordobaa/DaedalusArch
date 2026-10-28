import type { DonationRepository } from '../../../application/ports/out/donation.repository';
import type { Donation } from '../../../domain/donation';

export class InMemoryDonationRepository implements DonationRepository {
  private readonly items: Donation[] = [];

  async save(donation: Donation): Promise<void> {
    this.items.push(donation);
  }
}
