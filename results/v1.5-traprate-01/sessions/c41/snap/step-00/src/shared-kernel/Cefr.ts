/** The Common European Framework scale, lowest step first. A public standard every part of the school shares. */
export const CEFR_SCALE = ['A1', 'A2', 'B1', 'B2', 'C1'] as const;

export type Cefr = (typeof CEFR_SCALE)[number];

export function isCefr(value: string): value is Cefr {
  return (CEFR_SCALE as readonly string[]).includes(value);
}

/** True when `held` is the step `needed` or a higher one. */
export function reaches(held: Cefr, needed: Cefr): boolean {
  return CEFR_SCALE.indexOf(held) >= CEFR_SCALE.indexOf(needed);
}
