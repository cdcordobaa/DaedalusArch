export type DietaryNeed = 'nut-allergy' | 'vegetarian' | 'halal';

export interface Household {
  id: string;
  name: string;
  postcode: string;
  people: number;
  dietaryNeeds: DietaryNeed[];
  phone?: string;
  smsReminder?: boolean;
}

const FORBIDDEN_CATEGORIES: Record<DietaryNeed, string[]> = {
  'nut-allergy': ['nuts'],
  vegetarian: ['meat', 'fish'],
  halal: ['pork'],
};

/** The dietary need that forbids the category, if any. */
export function conflictingNeed(h: Household, category: string): DietaryNeed | undefined {
  const c = category.toLowerCase();
  return h.dietaryNeeds.find((n) => FORBIDDEN_CATEGORIES[n]?.includes(c));
}
