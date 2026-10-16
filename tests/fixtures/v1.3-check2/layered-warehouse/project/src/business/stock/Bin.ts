import { Item } from './Item';
import { StockError } from './StockError';

export class Bin {
  code: string;
  sku: string | null;
  quantity: number;
  maxWeightGrams: number;

  constructor(code: string, sku: string | null, quantity: number, maxWeightGrams: number) {
    this.code = code;
    this.sku = sku;
    this.quantity = quantity;
    this.maxWeightGrams = maxWeightGrams;
  }

  put(item: Item, quantity: number): void {
    if (this.sku !== null && this.sku !== item.sku) throw new StockError(`Bin ${this.code} holds ${this.sku}`);
    if ((this.quantity + quantity) * item.unitWeightGrams > this.maxWeightGrams) throw new StockError(`Bin ${this.code} would be overloaded`);
    this.sku = item.sku;
    this.quantity += quantity;
  }

  take(quantity: number): void {
    if (quantity > this.quantity) throw new StockError(`Bin ${this.code} holds only ${this.quantity}`, true);
    this.quantity -= quantity;
    if (this.quantity === 0) this.sku = null;
  }
}
