import type { Outbox } from '../../messaging/Outbox';
import type { DomainEvent } from '../../shared-kernel/DomainEvent';
import { Shift, type ShiftState } from '../domain/shift/Shift';
import type { ShiftRepository } from '../domain/shift/ShiftRepository';
import { ShiftId } from '../domain/shift/value-objects/ShiftId';

/** Shifts and their outbox in one store: saving a shift stores its pending events in the same step. */
export class InMemoryShiftRepository implements ShiftRepository, Outbox {
  private readonly rows = new Map<string, ShiftState>();
  private outbox: DomainEvent[] = [];
  private sequence = 0;

  nextId(): ShiftId {
    this.sequence += 1;
    return ShiftId.of(`S-${String(this.sequence).padStart(4, '0')}`);
  }

  byId(id: ShiftId): Shift | undefined {
    const row = this.rows.get(id.value);
    return row === undefined ? undefined : Shift.restore(row);
  }

  save(shift: Shift): void {
    const events = shift.pullEvents();
    this.rows.set(shift.id.value, shift.state());
    this.outbox = [...this.outbox, ...events];
  }

  takePending(): DomainEvent[] {
    const out = this.outbox;
    this.outbox = [];
    return out;
  }
}
