export class Donation {
  constructor(
    readonly id: string,
    readonly donorEmail: string,
    readonly amountCents: number,
    readonly currency: string,
  ) {}
}
