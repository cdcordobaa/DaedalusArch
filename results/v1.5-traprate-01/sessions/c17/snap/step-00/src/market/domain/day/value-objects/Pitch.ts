export type PitchKind = 'hall' | 'open';

/** Daily fee per kind of pitch: covered food-hall pitches and open-air pitches. */
const DAILY_FEE: Readonly<Record<PitchKind, number>> = { hall: 40, open: 25 };

/** One pitch of the day's layout. Immutable. */
export class Pitch {
  private constructor(
    readonly code: string,
    readonly kind: PitchKind,
  ) {}

  static of(code: string, kind: string): Pitch {
    if (code.trim() === '') throw new Error('a pitch needs a code');
    if (kind !== 'hall' && kind !== 'open') throw new Error(`pitch ${code}: kind must be hall or open`);
    return new Pitch(code.trim(), kind);
  }

  fee(): number {
    return DAILY_FEE[this.kind];
  }
}
