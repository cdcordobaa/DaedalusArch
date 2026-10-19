export class Invoice {
  constructor(
    readonly id: string,
    readonly issuedAtMs: number,
    readonly amountCents: number,
  ) {}
}
