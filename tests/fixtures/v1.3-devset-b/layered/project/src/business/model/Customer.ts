export class Customer {
  constructor(
    readonly id: string,
    readonly name: string,
    readonly email: string,
    readonly loyaltyTier: 'standard' | 'gold',
  ) {}

  get isGold(): boolean {
    return this.loyaltyTier === 'gold';
  }
}
