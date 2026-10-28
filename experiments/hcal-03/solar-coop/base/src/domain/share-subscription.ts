import { DomainError } from './errors';

export class ShareSubscription {
  private constructor(
    readonly id: string,
    readonly memberId: string,
    private _shares: number,
    private _active: boolean,
  ) {}
  static open(id: string, memberId: string, shares: number): ShareSubscription {
    if (shares <= 0) throw new DomainError('shares must be positive');
    return new ShareSubscription(id, memberId, shares, true);
  }
  static totalShares(subscriptions: ShareSubscription[]): number {
    return subscriptions.reduce((sum, s) => sum + s.shares, 0);
  }
  get shares(): number {
    return this._shares;
  }
  get active(): boolean {
    return this._active;
  }
  addShares(count: number): void {
    if (count <= 0) throw new DomainError('shares must be positive');
    this._shares += count;
  }
  cancel(): void {
    this._active = false;
  }
}
