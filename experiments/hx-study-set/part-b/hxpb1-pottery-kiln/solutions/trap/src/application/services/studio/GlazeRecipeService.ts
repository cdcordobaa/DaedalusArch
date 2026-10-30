import { StudioError } from '../../../domain/errors/StudioError';
import type { GlazeRecipe } from '../../../domain/model/studio/GlazeRecipe';
import type { GlazeRecipes } from '../../ports/out/studio/GlazeRecipes';

/** The glaze book: every change is a new version, old batches keep theirs. */
export class GlazeRecipeService {
  constructor(private readonly recipes: GlazeRecipes) {}

  async publish(name: string, grams: Record<string, number>): Promise<GlazeRecipe> {
    const total = Object.values(grams).reduce((a, b) => a + b, 0);
    if (total <= 0) throw new StudioError('a glaze needs at least one material');
    const versions = await this.recipes.versionsOf(name);
    const recipe: GlazeRecipe = { name, version: versions.length + 1, grams: { ...grams } };
    await this.recipes.append(recipe);
    return recipe;
  }

  async current(name: string): Promise<GlazeRecipe> {
    const versions = await this.recipes.versionsOf(name);
    const last = versions[versions.length - 1];
    if (last === undefined) throw new StudioError('no glaze called ' + name);
    return last;
  }
}
