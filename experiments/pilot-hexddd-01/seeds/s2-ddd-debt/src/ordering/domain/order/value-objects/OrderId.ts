export class OrderId {
  constructor(readonly value: string) {
    if (value.length === 0) throw new Error('OrderId is empty');
  }

  equals(other: OrderId): boolean {
    return this.value === other.value;
  }
}
