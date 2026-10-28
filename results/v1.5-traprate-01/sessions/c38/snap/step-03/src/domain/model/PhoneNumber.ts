import { ClinicError } from '../errors/ClinicError';

/** A patient's mobile number in international form: a plus sign and 8 to 15 digits, spaces ignored. */
export class PhoneNumber {
  private constructor(readonly value: string) {}

  static of(raw: string): PhoneNumber {
    const value = raw.replace(/\s+/g, '');
    if (!/^\+[1-9]\d{7,14}$/.test(value)) throw new ClinicError('phone number must be in international form, such as +31612345678');
    return new PhoneNumber(value);
  }

  equals(other: PhoneNumber): boolean {
    return this.value === other.value;
  }
}
