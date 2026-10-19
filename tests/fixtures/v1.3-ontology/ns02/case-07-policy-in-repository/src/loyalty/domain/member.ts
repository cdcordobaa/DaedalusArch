export type Tier = 'standard' | 'gold';

export class Member {
  constructor(
    readonly id: string,
    readonly annualSpend: number,
    readonly yearsActive: number,
    private tier: Tier = 'standard',
  ) {}

  get currentTier(): Tier {
    return this.tier;
  }

  promoteToGold(): void {
    this.tier = 'gold';
  }
}
