import { DomainError } from '../../../domain/errors';
import type { RecordDonationPort } from '../../../application/ports/in/record-donation.port';
import type { DonationRequestDto, DonationResponseDto } from './donation.dto';
import type { HttpResult } from './http-result';
import { resolveNotifier } from './lookup';

export class DonationController {
  constructor(private readonly recordDonation: RecordDonationPort) {}

  async post(dto: DonationRequestDto): Promise<HttpResult<DonationResponseDto>> {
    try {
      const donation = await this.recordDonation.execute({
        donorEmail: dto.donorEmail,
        amountCents: dto.amountCents,
        currency: dto.currency,
      });
      await resolveNotifier().send('treasurer@radio.example', 'New donation', `Donation ${donation.id} received`);
      return { status: 201, body: { id: donation.id } };
    } catch (error) {
      if (error instanceof DomainError) return { status: 422, body: { error: error.message } };
      throw error;
    }
  }
}
