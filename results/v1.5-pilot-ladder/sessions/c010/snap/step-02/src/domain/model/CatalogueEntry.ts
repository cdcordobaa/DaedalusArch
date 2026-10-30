/** A title as the catalogue knows it. */
export interface CatalogueEntry {
  readonly isbn: string;
  readonly title: string;
  readonly author: string;
  readonly year: number;
}

/** How a book is bound: hardcover, paperback, or anything else (spiral-bound, board books). */
export type Binding = 'hardback' | 'paperback' | 'other';

/** The edition behind an ISBN, as the catalogue knows it. */
export interface Edition {
  readonly year: number;
  readonly pages: number;
  readonly binding: Binding;
}
