/** A title as the catalogue knows it. */
export interface CatalogueEntry {
  readonly isbn: string;
  readonly title: string;
  readonly author: string;
  readonly year: number;
  readonly pages: number;
}
