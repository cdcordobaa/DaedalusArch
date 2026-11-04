import { Haul } from '../haul/Haul';
import { AllowanceExceededError } from '../truck/AllowanceExceededError';
import { Truck } from '../truck/Truck';

export class PayloadPolicy {
  assertWithinAllowance(truck: Truck, haulsThisShift: readonly Haul[], tonnes: number, shiftDate: string): void {
    const hauled = haulsThisShift.reduce((sum, h) => sum + h.tonnes, 0);
    if (hauled + tonnes > truck.shiftAllowanceTonnes) throw new AllowanceExceededError(truck.id, shiftDate);
  }
}
