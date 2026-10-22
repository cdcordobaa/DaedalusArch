export class Customer {
  private constructor(readonly id: string, readonly name: string, private purchases: number) {}

  static register(id: string, name: string): Customer {
    return new Customer(id, name, 0);
  }

  recordPurchase(): void {
    this.purchases += 1;
  }

  get purchaseCount(): number {
    return this.purchases;
  }
}
