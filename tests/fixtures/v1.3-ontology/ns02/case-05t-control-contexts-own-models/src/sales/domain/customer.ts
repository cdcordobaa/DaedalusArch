export class Customer {
  constructor(
    readonly id: string,
    readonly email: string,
    readonly name: string,
    private readonly lifetimeSpend: number,
  ) {}

  isVip(): boolean {
    return this.lifetimeSpend > 10000;
  }
}
