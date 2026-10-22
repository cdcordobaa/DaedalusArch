export class Product {
  constructor(readonly id: string, private stock: number) {}

  reserve(quantity: number): void {
    if (quantity > this.stock) throw new Error('not enough stock');
    this.stock -= quantity;
  }
}
