import { InvalidRequest } from '../errors/LoungeErrors';

/** Guests are welcome again from this local hour until the cut-off. */
export const GUESTS_AGAIN_FROM_HOUR = 5;

/** What a partner airline allows the holders of its passes. */
export class PartnerRule {
  private constructor(readonly airline: string, readonly guestAllowance: number, readonly guestCutoff: number | null) {}

  static create(airline: string, guestAllowance: number, guestCutoff: number | null = null): PartnerRule {
    const code = airline.trim().toUpperCase();
    if (!/^[A-Z0-9]{2}$/.test(code)) throw new InvalidRequest('airline must be a two-character code');
    if (!Number.isInteger(guestAllowance) || guestAllowance < 0 || guestAllowance > 5) throw new InvalidRequest('guest allowance must be a whole number from 0 to 5');
    if (guestCutoff !== null && (!Number.isInteger(guestCutoff) || guestCutoff < 12 || guestCutoff > 23)) throw new InvalidRequest('guest cut-off must be a whole hour from 12 to 23');
    return new PartnerRule(code, guestAllowance, guestCutoff);
  }

  /** 'LU allows at most 1 guest', 'NW allows at most 2 guests'. */
  allowanceText(): string {
    return `${this.airline} allows at most ${String(this.guestAllowance)} ${this.guestAllowance === 1 ? 'guest' : 'guests'}`;
  }

  /** May guests come in at this local hour? */
  guestsWelcomeAt(localHour: number): boolean {
    return this.guestCutoff === null || (localHour >= GUESTS_AGAIN_FROM_HOUR && localHour < this.guestCutoff);
  }

  /** 'no guests between 21:00 and 05:00 at ZRH' */
  cutoffText(airport: string): string {
    const hh = (h: number): string => `${String(h).padStart(2, '0')}:00`;
    return `no guests between ${hh(this.guestCutoff ?? 0)} and ${hh(GUESTS_AGAIN_FROM_HOUR)} at ${airport}`;
  }
}
