/** One published version of a studio glaze. */
export interface GlazeRecipe {
  readonly name: string;
  readonly version: number;
  readonly grams: Readonly<Record<string, number>>;
}
