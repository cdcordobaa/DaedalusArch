import type { CatalogueEntry } from '../../../domain/model/CatalogueEntry';

/** Titles we can look up, in the application's own terms. */
export interface Catalogue {
  search(text: string): Promise<CatalogueEntry[]>;
  factsFor(isbn: string): Promise<{ pub_year: number; page_count: number; binding_code: string }>;
}
