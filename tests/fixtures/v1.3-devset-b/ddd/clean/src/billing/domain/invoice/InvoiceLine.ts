import type { Money } from '../../../shared-kernel/value-objects/Money.js';

/** Inner entity of the Invoice aggregate. */
export class InvoiceLine {
  constructor(readonly lineNo: number, readonly description: string, readonly amount: Money) {}
}
