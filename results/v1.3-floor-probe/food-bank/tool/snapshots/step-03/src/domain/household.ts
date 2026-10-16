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
