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
  readonly year: number;
  readonly pages: number;
  readonly binding: string;
}

export interface ListCopy {
  list(request: ListCopyRequest): Promise<CopyView>;
  find(copyId: string): Promise<CopyView>;
}
