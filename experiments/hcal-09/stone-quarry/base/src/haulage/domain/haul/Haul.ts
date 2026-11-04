export class Haul {
  private constructor(
    readonly id: string,
    readonly truckId: string,
    readonly orderId: string,
    readonly ticketNo: string,
    readonly tonnes: number,
    readonly shiftDate: string,
  ) {}

  static record(id: string, truckId: string, orderId: string, ticketNo: string, tonnes: number, shiftDate: string): Haul {
    return new Haul(id, truckId, orderId, ticketNo, tonnes, shiftDate);
  }
}
