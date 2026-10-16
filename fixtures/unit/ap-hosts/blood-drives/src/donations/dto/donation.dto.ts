import { DonationDocument } from '../../persistence/schemas/donation.schema';

export class RecordDonationDto {
  hemoglobin!: number;
  volumeMl!: number;
  bagNumber!: string;
}

export interface DonationView {
  readonly id: string;
  readonly appointmentId: string;
  readonly volumeMl: number;
  readonly bagNumber: string;
  readonly collectedAt: string;
}

export function toDonationView(d: DonationDocument): DonationView {
  return { id: d.id, appointmentId: d.appointmentId, volumeMl: d.volumeMl, bagNumber: d.bagNumber, collectedAt: d.collectedAt.toISOString() };
}
