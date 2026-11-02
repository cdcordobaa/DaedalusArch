/** What a quote means for a hire: bound (cover in place), referred (underwriter looking), or none. */
export type HireCover = 'bound' | 'referred' | 'none';

/** The hire's cover for the state text the insurer sends with a quote. */
export function hireCoverOf(insurerState: string): HireCover {
  switch (insurerState) {
    case 'BOUND': return 'bound';
    case 'REFERRED': return 'referred';
    default: return 'none';
  }
}
