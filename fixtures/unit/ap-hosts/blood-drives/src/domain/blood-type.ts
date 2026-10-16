import { DomainError } from './domain-error';

export const BLOOD_TYPES = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'] as const;

export type BloodTypeCode = (typeof BLOOD_TYPES)[number];

export function isBloodType(value: string): value is BloodTypeCode {
  return (BLOOD_TYPES as readonly string[]).includes(value);
}

export class UnknownBloodTypeError extends DomainError {
  constructor(value: string) {
    super('UNKNOWN_BLOOD_TYPE', `"${value}" is not an ABO/RhD type`);
  }
}

/** ABO group and RhD factor of a donor, as confirmed by the lab after the first donation. */
export class BloodType {
  readonly code: BloodTypeCode;

  constructor(code: BloodTypeCode) {
    this.code = code;
  }

  isUniversalDonor(): boolean {
    return this.code === 'O-';
  }

  /** Types the hospitals are short of trigger a recall campaign. */
  isScarce(): boolean {
    return this.code.endsWith('-');
  }
}
