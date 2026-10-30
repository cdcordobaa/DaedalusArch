import type { CatalogueEntry, Edition } from '../../../domain/model/CatalogueEntry';

/** Titles we can look up, in the application's own terms. */
export interface Catalogue {
  search(text: string): Promise<CatalogueEntry[]>;
  /** The edition for an ISBN, or null when the catalogue does not know it. */
  edition(isbn: string): Promise<Edition | null>;
}
