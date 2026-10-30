/** The phases of a stay, as the inn's house rules name them (see GLOSSARY.md). */
export type StayPhase = 'reserved' | 'guaranteed' | 'in-house' | 'departed' | 'cancelled';

export interface Stay {
  readonly reservationId: string;
  readonly phase: StayPhase;
  readonly nightlyRateCents: number;
}

/** House rule: only an in-house guest's folio takes room charges. */
export function mayPostCharge(stay: Stay): boolean {
  return stay.phase === 'in-house';
}
