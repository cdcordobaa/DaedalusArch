/** Billing's model of whoever settles an invoice: only what billing needs. */
export class Payer {
  constructor(
    readonly payerId: string,
    readonly invoiceEmail: string,
    readonly taxId: string,
    readonly billingAddress: string,
  ) {}
}
