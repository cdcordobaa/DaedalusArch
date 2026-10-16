import { ProductGateway } from '../../persistence/ProductGateway';
import { BusinessError } from '../errors/BusinessError';
import { Product } from '../model/Product';
import { toProduct } from './RecordMapping';

/** Service Layer (Fowler 2002) for the catalogue. */
export class CatalogService {
  constructor(private readonly products: ProductGateway) {}

  listProducts(): Product[] {
    return this.products.findAll().map(toProduct);
  }

  getProduct(sku: string): Product {
    const record = this.products.findBySku(sku);
    if (record === undefined) throw new BusinessError('NOT_FOUND', `No product ${sku}`);
    return toProduct(record);
  }

  addProduct(sku: string, name: string, priceCents: number, stock: number): Product {
    if (this.products.findBySku(sku) !== undefined) throw new BusinessError('CONFLICT', `Product ${sku} exists`);
    this.products.insert({ sku, name, priceCents, stock });
    return this.getProduct(sku);
  }
}
