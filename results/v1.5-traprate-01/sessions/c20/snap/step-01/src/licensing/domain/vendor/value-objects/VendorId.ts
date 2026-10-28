export class VendorId {
  private constructor(readonly value: string) {}

  static of(value: string): VendorId {
    if (value.trim() === '') throw new Error('vendor id must not be empty');
    return new VendorId(value);
  }
}
