export class Ticket {
  constructor(
    readonly id: string,
    readonly orderId: string,
    readonly openedAtMs: number,
  ) {}
}
