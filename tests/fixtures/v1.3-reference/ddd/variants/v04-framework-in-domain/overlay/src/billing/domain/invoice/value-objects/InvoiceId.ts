import { plainToInstance } from 'class-transformer';

// VIOLATION (framework-free domain): the domain uses a framework serialisation library.
export class InvoiceId {
  constructor(readonly value: string) {
    if (value.length === 0) throw new Error('InvoiceId is empty');
  }

  static fromPlain(raw: { value: string }): InvoiceId {
    return plainToInstance(InvoiceId, raw);
  }
}
