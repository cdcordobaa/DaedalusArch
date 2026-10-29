import type { CatalogueEntry } from '../../../domain/model/CatalogueEntry';

/** Titles we can look up, in the application's own terms. */
export interface Catalogue {
  search(text: string): Promise<CatalogueEntry[]>;
}
