import type { GlazeRecipe } from '../../../../domain/model/studio/GlazeRecipe';

export interface GlazeRecipes {
  versionsOf(name: string): Promise<GlazeRecipe[]>;
  append(recipe: GlazeRecipe): Promise<void>;
}
