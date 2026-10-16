import { DonorDocument } from '../../persistence/schemas/donor.schema';

export class RegisterDonorDto {
  fullName!: string;
  birthDate!: string;
  sex!: string;
  bloodType!: string;
  phone!: string;
}

export class DeferDonorDto {
  reason!: string;
  weeks!: number;
}

export interface DonorView {
  readonly id: string;
  readonly fullName: string;
  readonly bloodType: string;
  readonly nextEligibleOn: string | null;
  readonly deferredUntil: string | null;
}

export function toDonorView(d: DonorDocument, nextEligibleOn: Date | null): DonorView {
  return {
    id: d.id,
    fullName: d.fullName,
    bloodType: d.bloodType,
    nextEligibleOn: nextEligibleOn === null ? null : nextEligibleOn.toISOString().slice(0, 10),
    deferredUntil: d.deferral === null ? null : d.deferral.until.toISOString().slice(0, 10),
  };
}
