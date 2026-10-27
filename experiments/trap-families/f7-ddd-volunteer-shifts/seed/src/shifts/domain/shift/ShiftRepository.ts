import type { Shift } from './Shift';
import type { ShiftId } from './value-objects/ShiftId';

export interface ShiftRepository {
  nextId(): ShiftId;
  byId(id: ShiftId): Shift | undefined;
  /** Stores the shift and its pending events in one step. */
  save(shift: Shift): void;
}
