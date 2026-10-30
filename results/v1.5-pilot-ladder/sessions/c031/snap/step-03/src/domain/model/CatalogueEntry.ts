/** A title as the catalogue knows it. */
export interface CatalogueEntry {
  readonly isbn: string;
  readonly title: string;
  readonly author: string;
  readonly year: number;
}

/** The year, page count and binding of one edition. */
export interface EditionFacts {
  readonly year: number;
  readonly pages: number;
  readonly binding: 'hardback' | 'paperback' | 'other';
}
