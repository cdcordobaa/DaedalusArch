import { AccessRefused, InvalidRequest } from '../errors/LoungeErrors';
import type { LocalDate } from '../model/LocalDate';
import type { Lounge } from '../model/Lounge';
import type { Pass } from '../model/Pass';
import type { PartnerRule } from '../model/PartnerRule';

/** Everything the entry decision needs, gathered by the caller. */
export interface EntryFacts {
  readonly lounge: Lounge;
  readonly pass: Pass;
  /** The partner rule of the pass's airline, or null when the airline is no partner (or the pass is a day pass). */
  readonly partner: PartnerRule | null;
  readonly guests: number;
  /** People (holders and guests) in the lounge now. */
  readonly peopleInside: number;
  /** Whether the pass already has a visit in progress anywhere. */
  readonly passInside: boolean;
  /** Today's date at the lounge's airport. */
  readonly today: LocalDate;
}

export function checkGuestNumber(guests: number): void {
  if (!Number.isInteger(guests) || guests < 0) throw new InvalidRequest('guests must be a whole number from 0');
}

/** May this pass bring `guests` guests into this lounge? */
export function checkGuests(lounge: Lounge, pass: Pass, partner: PartnerRule | null, guests: number): void {
  if (pass.kind === 'day') {
    if (guests > 0) throw new AccessRefused('day passes allow no guests');
    return;
  }
  if (partner === null || !lounge.accepts(pass.airline)) throw new AccessRefused(`${pass.airline} passes are not accepted at ${lounge.id}`);
  if (guests > partner.guestAllowance) throw new AccessRefused(partner.allowanceText());
}

/** Is there room for `adding` more people? */
export function checkRoom(lounge: Lounge, peopleInside: number, adding: number): void {
  if (peopleInside + adding > lounge.capacity) throw new AccessRefused(`lounge ${lounge.id} is full`);
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
  checkGuests(f.lounge, f.pass, f.partner, f.guests);
  checkRoom(f.lounge, f.peopleInside, 1 + f.guests);
}
