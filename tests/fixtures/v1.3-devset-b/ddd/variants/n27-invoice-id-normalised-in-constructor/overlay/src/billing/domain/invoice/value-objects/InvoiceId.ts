export class InvoiceId {
  readonly value: string;

  constructor(raw: string) {
    const value = raw.trim().toUpperCase();
    if (value.length === 0) throw new Error('InvoiceId is empty');
    this.value = value;
  }

  equals(other: InvoiceId): boolean {
    return this.value === other.value;
  }
}
