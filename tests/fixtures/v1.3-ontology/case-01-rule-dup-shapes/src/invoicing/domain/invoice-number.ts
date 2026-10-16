export class InvoiceNumber {
  constructor(readonly year: number, readonly sequence: number) {}

  format(): string {
    return `INV-${String(this.year)}-${String(this.sequence).padStart(6, '0')}`;
  }
}
