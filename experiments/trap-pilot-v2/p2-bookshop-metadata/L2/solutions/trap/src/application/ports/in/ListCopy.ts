export interface ListCopyRequest {
  readonly copyId: string;
  readonly isbn: string;
  readonly condition: string;
  readonly price: number;
}

export interface CopyView {
  readonly copyId: string;
  readonly isbn: string;
  readonly title: string;
  readonly author: string;
  readonly condition: string;
  readonly price: number;
  readonly pub_year: number;
  readonly page_count: number;
  readonly binding_code: string;
  readonly binding: string;
}

export interface ListCopy {
  list(request: ListCopyRequest): Promise<CopyView>;
  find(copyId: string): Promise<CopyView>;
}
