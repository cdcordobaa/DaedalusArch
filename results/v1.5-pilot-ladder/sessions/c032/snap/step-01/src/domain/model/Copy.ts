/** One second-hand copy on our shelves; the price is in euros. */
export interface Copy {
  readonly copyId: string;
  readonly isbn: string;
  readonly title: string;
  readonly author: string;
  readonly condition: 'as new' | 'good' | 'worn';
  readonly price: number;
  readonly year: number;
  readonly pages: number;
}
