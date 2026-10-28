export class LicenceNumber {
  private constructor(readonly value: string) {}

  static parse(raw: string): LicenceNumber {
    if (!/^[A-Z]{2}-\d{6}$/.test(raw.trim())) {
      throw new Error('invalid licence number');
    }
    return new LicenceNumber(raw.trim());
  }
}
