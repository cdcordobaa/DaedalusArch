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
  readonly pubYear: number;
  readonly pageCount: number;
}

export interface ListCopy {
  list(request: ListCopyRequest): Promise<CopyView>;
  find(copyId: string): Promise<CopyView>;
}
