import { InMemoryDatabase } from './Database';
import { ProductRecord } from './records/ProductRecord';

/** Table Data Gateway (Fowler 2002) for the products table. */
export class ProductGateway {
  constructor(private readonly db: InMemoryDatabase) {}

  findBySku(sku: string): ProductRecord | undefined {
    return this.db.table<ProductRecord>('products').get(sku);
  }

  findAll(): ProductRecord[] {
    return [...this.db.table<ProductRecord>('products').values()];
  }

  insert(record: ProductRecord): void {
    this.db.table<ProductRecord>('products').set(record.sku, { ...record });
  }

  updateStock(sku: string, stock: number): void {
    const row = this.findBySku(sku);
    if (row !== undefined) this.db.table<ProductRecord>('products').set(sku, { ...row, stock });
  }
}
