import type { CatalogueEntry, EditionFacts } from '../../../domain/model/CatalogueEntry';

/** Titles we can look up, in the application's own terms. */
export interface Catalogue {
  search(text: string): Promise<CatalogueEntry[]>;
  /** Facts of the edition with this ISBN; rejects with a ShopError when the catalogue does not know it. */
  edition(isbn: string): Promise<EditionFacts>;
}
