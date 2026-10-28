import { InvalidRequest } from '../errors/LoungeErrors';

/** What a partner airline allows the holders of its passes. */
export class PartnerRule {
  private constructor(readonly airline: string, readonly guestAllowance: number) {}

  static create(airline: string, guestAllowance: number): PartnerRule {
    const code = airline.trim().toUpperCase();
    if (!/^[A-Z0-9]{2}$/.test(code)) throw new InvalidRequest('airline must be a two-character code');
    if (!Number.isInteger(guestAllowance) || guestAllowance < 0 || guestAllowance > 5) throw new InvalidRequest('guest allowance must be a whole number from 0 to 5');
    return new PartnerRule(code, guestAllowance);
  }

  /** 'LU allows at most 1 guest', 'NW allows at most 2 guests'. */
  allowanceText(): string {
    return `${this.airline} allows at most ${String(this.guestAllowance)} ${this.guestAllowance === 1 ? 'guest' : 'guests'}`;
  }
}
