import type { GlazeRecipe } from '../../../../domain/model/studio/GlazeRecipe';
import type { GlazeRecipes } from '../../../../application/ports/out/studio/GlazeRecipes';

export class InMemoryGlazeRecipes implements GlazeRecipes {
  private readonly book = new Map<string, GlazeRecipe[]>();

  async versionsOf(name: string): Promise<GlazeRecipe[]> {
    return [...(this.book.get(name) ?? [])];
  }

  async append(recipe: GlazeRecipe): Promise<void> {
    this.book.set(recipe.name, [...(this.book.get(recipe.name) ?? []), recipe]);
  }
}
