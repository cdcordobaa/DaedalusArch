import { Product } from '../../business/model/Product';

export interface ProductViewModel {
  sku: string;
  name: string;
  price: string;
  inStock: boolean;
}

export function renderProduct(product: Product): ProductViewModel {
  return { sku: product.sku, name: product.name, price: product.price.format(), inStock: product.stock > 0 };
}
