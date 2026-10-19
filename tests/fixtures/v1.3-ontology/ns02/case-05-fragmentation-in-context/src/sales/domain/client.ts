/** The person a sales quote is addressed to. */
export class Client {
  constructor(
    readonly clientId: string,
    readonly emailAddress: string,
    readonly displayName: string,
    readonly creditLimit: number,
  ) {}

  canAfford(amount: number): boolean {
    return amount <= this.creditLimit;
  }
}
