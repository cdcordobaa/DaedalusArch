export type Binding = 'hardback' | 'paperback' | 'other';

/** A title as the catalogue knows it. */
export interface CatalogueEntry {
  readonly isbn: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly author: string;
  readonly year: number;
  readonly pageCount: number;
  readonly binding: Binding;
}
