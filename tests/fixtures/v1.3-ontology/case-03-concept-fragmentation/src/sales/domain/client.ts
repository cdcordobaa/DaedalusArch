export class Client {
  constructor(
    readonly id: string,
    readonly email: string,
    readonly fullName: string,
    private readonly lifetimeSpend: number,
  ) {}

  isVip(): boolean {
    return this.lifetimeSpend > 10000;
  }
}
