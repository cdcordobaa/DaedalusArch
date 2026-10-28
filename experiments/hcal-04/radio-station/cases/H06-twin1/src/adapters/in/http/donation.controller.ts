import { DomainError } from '../../../domain/errors';
import type { RecordDonationPort } from '../../../application/ports/in/record-donation.port';
import type { DonationRequestDto, DonationResponseDto } from './donation.dto';
import type { HttpResult } from './http-result';

const EMAIL_SHAPE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export class DonationController {
  constructor(private readonly recordDonation: RecordDonationPort) {}

  async post(dto: DonationRequestDto): Promise<HttpResult<DonationResponseDto>> {
    if (typeof dto.amountCents !== 'number' || !Number.isInteger(dto.amountCents)) {
      return { status: 400, body: { error: 'amountCents must be an integer' } };
    }
    if (typeof dto.donorEmail !== 'string' || !EMAIL_SHAPE.test(dto.donorEmail)) {
      return { status: 400, body: { error: 'donorEmail is malformed' } };
    }
    try {
      const donation = await this.recordDonation.execute({
        donorEmail: dto.donorEmail,
        amountCents: dto.amountCents,
        currency: dto.currency,
      });
      return { status: 201, body: { id: donation.id } };
    } catch (error) {
      if (error instanceof DomainError) return { status: 422, body: { error: error.message } };
      throw error;
    }
  }
}
