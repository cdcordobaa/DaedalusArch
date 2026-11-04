export class EmptyOrderError extends Error {
  constructor(orderId: string) {
    super(`order ${orderId} needs at least one line`);
  }
}
