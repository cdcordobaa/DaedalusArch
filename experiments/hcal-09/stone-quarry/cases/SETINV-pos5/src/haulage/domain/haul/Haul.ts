import { AllowanceExceededError } from '../truck/AllowanceExceededError';

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

  static recordWithin(shiftHauls: readonly Haul[], allowanceTonnes: number, id: string, truckId: string, orderId: string, ticketNo: string, tonnes: number, shiftDate: string): Haul {
    const hauled = shiftHauls.filter((h) => h.truckId === truckId && h.shiftDate === shiftDate).reduce((sum, h) => sum + h.tonnes, 0);
    if (hauled + tonnes > allowanceTonnes) throw new AllowanceExceededError(truckId, shiftDate);
    return new Haul(id, truckId, orderId, ticketNo, tonnes, shiftDate);
  }
}
