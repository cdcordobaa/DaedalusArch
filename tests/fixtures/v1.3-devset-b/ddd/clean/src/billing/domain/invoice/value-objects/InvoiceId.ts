export class InvoiceId {
  constructor(readonly value: string) {
    if (value.length === 0) throw new Error('InvoiceId is empty');
  }
}
