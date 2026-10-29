import type { Binding } from './Binding';

/** A title as the catalogue knows it. */
export interface CatalogueEntry {
  readonly isbn: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly author: string;
  readonly year: number;
  readonly pages: number;
  readonly binding: Binding;
  readonly coverUrl?: string;
}
