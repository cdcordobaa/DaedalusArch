/** One second-hand copy on our shelves; the price is in euros. */
export interface Copy {
  readonly copyId: string;
  readonly isbn: string;
  readonly title: string;
  readonly author: string;
  readonly condition: 'as new' | 'good' | 'worn';
  readonly price: number;
  /** Year the edition came out, as the catalogue knew it when the copy was listed. */
  readonly year: number;
  /** Number of pages of the edition, as the catalogue knew it when the copy was listed. */
  readonly pages: number;
}
