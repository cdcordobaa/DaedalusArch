/** One second-hand copy on our shelves; the price is in euros. */
export interface Copy {
  readonly copyId: string;
  readonly isbn: string;
  readonly title: string;
  readonly author: string;
  readonly condition: 'as new' | 'good' | 'worn';
  readonly price: number;
  readonly pub_year: number;
  readonly page_count: number;
  readonly binding_code: string;
  readonly cover_url_large?: string;
}
