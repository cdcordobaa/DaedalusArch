import { Shift } from '../domain/shift/Shift';
import type { ShiftRepository } from '../domain/shift/ShiftRepository';

export class OpenShift {
  constructor(private readonly shifts: ShiftRepository) {}

  execute(name: string, places: number): string {
    const shift = Shift.open(this.shifts.nextId(), name, places);
    this.shifts.save(shift);
    return shift.id.value;
  }
}
