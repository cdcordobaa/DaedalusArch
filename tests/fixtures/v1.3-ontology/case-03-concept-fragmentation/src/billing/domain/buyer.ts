export class Buyer {
  constructor(
    readonly buyerId: string,
    readonly emailAddress: string,
    readonly displayName: string,
    readonly billingAddress: string,
  ) {}

  label(): string {
    return `${this.displayName} <${this.emailAddress}>`;
  }
}
