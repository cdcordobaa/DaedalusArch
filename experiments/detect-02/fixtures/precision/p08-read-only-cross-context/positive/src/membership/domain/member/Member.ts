export type Tier = 'standard' | 'silver' | 'gold';

export class Member {
  constructor(readonly id: string, private points: number) {}

  award(points: number): void {
    this.points += points;
  }

  get tier(): Tier {
    return this.points >= 1000 ? 'gold' : this.points >= 300 ? 'silver' : 'standard';
  }
}
