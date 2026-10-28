import type { Donation } from '../../../domain/donation';

export interface RecordDonationCommand {
  donorEmail: string;
  amountCents: number;
  currency: string;
}

export interface RecordDonationPort {
  execute(command: RecordDonationCommand): Promise<Donation>;
}
