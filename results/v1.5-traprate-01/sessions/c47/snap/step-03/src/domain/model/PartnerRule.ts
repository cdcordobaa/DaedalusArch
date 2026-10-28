import { InvalidRequest } from '../errors/LoungeErrors';

/** What a partner airline allows the holders of its passes. */
export class PartnerRule {
  private constructor(readonly airline: string, readonly guestAllowance: number, readonly guestCutoff: number | null) {}

  static create(airline: string, guestAllowance: number, guestCutoff?: number): PartnerRule {
    const code = airline.trim().toUpperCase();
    if (!/^[A-Z0-9]{2}$/.test(code)) throw new InvalidRequest('airline must be a two-character code');
    if (!Number.isInteger(guestAllowance) || guestAllowance < 0 || guestAllowance > 5) throw new InvalidRequest('guest allowance must be a whole number from 0 to 5');
    if (guestCutoff !== undefined && (!Number.isInteger(guestCutoff) || guestCutoff < 12 || guestCutoff > 23)) throw new InvalidRequest('guest cut-off must be a whole hour from 12 to 23');
    return new PartnerRule(code, guestAllowance, guestCutoff ?? null);
  }

  /** Whether guests are barred at local `hour` (from the cut-off until 05:00). */
  barsGuestsAt(hour: number): boolean {
    return this.guestCutoff !== null && (hour >= this.guestCutoff || hour < 5);
  }

  /** 'LU allows at most 1 guest', 'NW allows at most 2 guests'. */
  allowanceText(): string {
    return `${this.airline} allows at most ${String(this.guestAllowance)} ${this.guestAllowance === 1 ? 'guest' : 'guests'}`;
  }
}
