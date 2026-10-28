import { CanteenError } from '../errors/CanteenError';

export const ALLERGENS = ['gluten', 'milk', 'egg', 'nuts', 'peanuts', 'fish', 'sesame', 'soya'] as const;
export type Allergen = (typeof ALLERGENS)[number];

/** Checks a list of allergen names and returns it without repeats, in the order given. */
export function requireAllergens(list: readonly string[]): Allergen[] {
  const out: Allergen[] = [];
  for (const a of list) {
    if (!(ALLERGENS as readonly string[]).includes(a)) throw new CanteenError(`unknown allergen '${a}'`);
    if (!out.includes(a as Allergen)) out.push(a as Allergen);
  }
  return out;
}
