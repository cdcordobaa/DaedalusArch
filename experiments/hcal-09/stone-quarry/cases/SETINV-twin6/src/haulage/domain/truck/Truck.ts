import { Haul } from '../haul/Haul';
import { AllowanceExceededError } from './AllowanceExceededError';

export class Truck {
  constructor(
    readonly id: string,
    readonly plate: string,
    readonly shiftAllowanceTonnes: number,
  ) {}

  /** Invariant truck-shift-allowance: what this truck hauls in one shift stays within its shift allowance. */
  authoriseHaul(haulsThisShift: readonly Haul[], haulId: string, orderId: string, ticketNo: string, tonnes: number, shiftDate: string): Haul {
    const hauled = haulsThisShift
      .filter((h) => h.truckId === this.id && h.shiftDate === shiftDate)
      .reduce((sum, h) => sum + h.tonnes, 0);
    if (hauled + tonnes > this.shiftAllowanceTonnes) throw new AllowanceExceededError(this.id, shiftDate);
    return Haul.record(haulId, this.id, orderId, ticketNo, tonnes, shiftDate);
  }

  /** Same invariant, given the shift's total so far instead of the hauls themselves. */
  authoriseHaulGivenTotal(hauledThisShift: number, haulId: string, orderId: string, ticketNo: string, tonnes: number, shiftDate: string): Haul {
    if (hauledThisShift + tonnes > this.shiftAllowanceTonnes) throw new AllowanceExceededError(this.id, shiftDate);
    return Haul.record(haulId, this.id, orderId, ticketNo, tonnes, shiftDate);
  }
}
