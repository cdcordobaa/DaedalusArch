import { Entity } from 'typeorm';

@Entity()
export class Order {
  private readonly lines: { sku: string; quantity: number }[] = [];

  constructor(readonly id: string) {}

  add(sku: string, quantity: number): void {
    if (quantity <= 0) throw new Error('quantity must be positive');
    this.lines.push({ sku, quantity });
  }

  count(): number {
    return this.lines.length;
  }
}
