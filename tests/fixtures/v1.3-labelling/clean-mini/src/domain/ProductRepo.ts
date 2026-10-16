export interface ProductRepo {
  find(id: string): string | undefined;
}
