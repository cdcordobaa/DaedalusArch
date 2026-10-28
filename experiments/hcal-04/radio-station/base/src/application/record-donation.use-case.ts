import { Donation } from '../domain/donation';
import { DonationPolicy } from '../domain/donation-policy';
import type { RecordDonationCommand, RecordDonationPort } from './ports/in/record-donation.port';
import type { DonationRepository } from './ports/out/donation.repository';
import type { Notifier } from './ports/out/notifier';

export class RecordDonationUseCase implements RecordDonationPort {
  private readonly policy = new DonationPolicy();

  constructor(
    private readonly donations: DonationRepository,
    private readonly notifier: Notifier,
  ) {}

  async execute(command: RecordDonationCommand): Promise<Donation> {
    this.policy.assertAcceptable(command.amountCents);
    const donation = new Donation(`don-${Date.now()}`, command.donorEmail, command.amountCents, command.currency);
    await this.donations.save(donation);
    await this.notifier.send(donation.donorEmail, 'Thank you', 'Your donation keeps the station on the air');
    return donation;
  }
}
