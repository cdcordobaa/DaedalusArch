const model = { define: (name: string, shape: Record<string, unknown>) => ({ name, shape }) };

export const Product = model.define('Product', { id: 'string', title: 'string' });

export interface IProductModuleService {
  createProducts(data: { title: string }[]): Promise<{ id: string }[]>;
  deleteProducts(ids: string[]): Promise<void>;
  listProducts(): Promise<{ id: string }[]>;
  createProductTags(data: { value: string }[]): Promise<void>;
}
