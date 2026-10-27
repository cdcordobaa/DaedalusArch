import type { ShiftView } from '../contracts/ShiftView';
import type { ShiftRepository } from '../domain/shift/ShiftRepository';
import { ShiftId } from '../domain/shift/value-objects/ShiftId';

export class GetShift {
  constructor(private readonly shifts: ShiftRepository) {}

  execute(shiftId: string): ShiftView | undefined {
    const shift = this.shifts.byId(ShiftId.of(shiftId));
    if (shift === undefined) return undefined;
    return { id: shift.id.value, name: shift.name, places: shift.places, placesFree: shift.placesFree() };
  }
}
