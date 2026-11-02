export class Order {
  constructor(readonly id: string, private total: number) {}
  get amount(): number { return this.total; }
  addLine(price: number): void { this.total += price; }
}
