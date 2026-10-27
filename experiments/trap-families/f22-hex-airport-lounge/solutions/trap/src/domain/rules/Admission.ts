import { AccessRefused, InvalidRequest, LoungeFull } from '../errors/LoungeErrors';
import { minutesBetween, type Instant } from '../model/Instant';
import type { LocalDate } from '../model/LocalDate';
import type { Lounge } from '../model/Lounge';
import type { Pass } from '../model/Pass';
import type { PartnerRule } from '../model/PartnerRule';
import type { Visit } from '../model/Visit';

/** No visit lasts longer than this; a full lounge expects a place when its longest visit reaches it. */
export const LONGEST_VISIT_MINUTES = 3 * 60;

/** Everything the entry decision needs, gathered by the caller. */
export interface EntryFacts {
  readonly lounge: Lounge;
  readonly pass: Pass;
  /** The partner rule of the pass's airline, or null when the airline is no partner (or the pass is a day pass). */
  readonly partner: PartnerRule | null;
  readonly guests: number;
  /** Visits in progress in the lounge now. */
  readonly inside: readonly Visit[];
  /** Whether the pass already has a visit in progress anywhere. */
  readonly passInside: boolean;
  /** Today's date at the lounge's airport. */
  readonly today: LocalDate;
  /** The hour shown at the lounge's airport now. */
  readonly localHour: number;
  readonly now: Instant;
}

export function checkGuestNumber(guests: number): void {
  if (!Number.isInteger(guests) || guests < 0) throw new InvalidRequest('guests must be a whole number from 0');
}

/** May this pass have `guests` guests in this lounge at this local hour? */
export function checkGuests(lounge: Lounge, pass: Pass, partner: PartnerRule | null, guests: number, localHour: number): void {
  if (pass.kind === 'day') {
    if (guests > 0) throw new AccessRefused('day passes allow no guests');
    return;
  }
  if (partner === null || !lounge.accepts(pass.airline)) throw new AccessRefused(`${pass.airline} passes are not accepted at ${lounge.id}`);
  if (guests > partner.guestAllowance) throw new AccessRefused(partner.allowanceText());
  if (guests > 0 && !partner.guestsWelcomeAt(localHour)) throw new AccessRefused(partner.cutoffText(lounge.airport));
}

/** Minutes until the longest visit in progress reaches the longest stay, rounded up, at least 1. */
export function minutesUntilPlace(inside: readonly Visit[], now: Instant): number {
  const longest = Math.max(0, ...inside.map((v) => minutesBetween(v.enteredAt, now)));
  return Math.max(1, Math.ceil(LONGEST_VISIT_MINUTES - longest));
}

/** Is there room for `adding` more people? */
export function checkRoom(lounge: Lounge, inside: readonly Visit[], adding: number, now: Instant): void {
  const people = inside.reduce((sum, v) => sum + v.people, 0);
  if (people + adding > lounge.capacity) throw new LoungeFull(lounge.id, minutesUntilPlace(inside, now));
}

/** The entry rules, in the order the desk reports them. */
export function checkEntry(f: EntryFacts): void {
  checkGuestNumber(f.guests);
  if (f.passInside) throw new AccessRefused(`pass ${f.pass.id} is already inside`);
  if (f.pass.kind === 'airline') {
    if (f.partner === null || !f.lounge.accepts(f.pass.airline)) throw new AccessRefused(`${f.pass.airline} passes are not accepted at ${f.lounge.id}`);
  } else {
    if (f.pass.airport !== f.lounge.airport) throw new AccessRefused(`day pass ${f.pass.id} is for ${f.pass.airport}`);
    if (f.pass.validOn !== f.today) throw new AccessRefused(`day pass ${f.pass.id} is valid on ${f.pass.validOn}`);
  }
  checkGuests(f.lounge, f.pass, f.partner, f.guests, f.localHour);
  checkRoom(f.lounge, f.inside, 1 + f.guests, f.now);
}
