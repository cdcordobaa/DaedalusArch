/** Where a hire's policy stands. */
export type PolicyStanding = 'live' | 'awaitingPapers' | 'cancelled';

/** The standing for the state text the insurer sends. */
export const STANDING_OF: Readonly<Record<string, PolicyStanding | undefined>> = {
  IN_FORCE: 'live',
  PENDING_DOCS: 'awaitingPapers',
  VOIDED: 'cancelled',
};
