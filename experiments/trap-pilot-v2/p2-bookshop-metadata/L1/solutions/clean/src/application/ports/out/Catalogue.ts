import type { CatalogueEntry } from '../../../domain/model/CatalogueEntry';
import type { BookFacts } from '../../../domain/model/BookFacts';

/** Titles we can look up, in the application's own terms. */
export interface Catalogue {
  search(text: string): Promise<CatalogueEntry[]>;
  factsFor(isbn: string): Promise<BookFacts>;
}
