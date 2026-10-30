export interface TitleView {
  readonly isbn: string;
  readonly title: string;
  readonly author: string;
  readonly year: number;
}

export interface SearchTitles {
  search(text: string): Promise<TitleView[]>;
}
