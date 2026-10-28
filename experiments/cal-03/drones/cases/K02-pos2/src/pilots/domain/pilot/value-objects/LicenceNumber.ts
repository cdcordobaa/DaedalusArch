import { validateSync } from 'class-validator';

export class LicenceNumber {
  private constructor(readonly value: string) {}

  static parse(raw: string): LicenceNumber {
    if (validateSync({ raw }).length > 0 || raw.trim() === '') {
      throw new Error('invalid licence number');
    }
    return new LicenceNumber(raw.trim());
  }
}
