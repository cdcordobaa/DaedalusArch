export class Order {
  constructor(
    readonly id: string,
    readonly createdAt: Date,
    readonly total: number,
    readonly customerId: string,
  ) {}
}
