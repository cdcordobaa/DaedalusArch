import type { DomainEvent } from '../../../shared-kernel/DomainEvent';
import { ShiftError } from '../ShiftError';
import { ShiftOpened } from './events/ShiftOpened';
import type { ShiftId } from './value-objects/ShiftId';

export interface ShiftState {
  readonly id: ShiftId;
  readonly name: string;
  readonly places: number;
  /** Places held, by holder. */
  readonly holds: Readonly<Record<string, number>>;
}

/** One volunteer shift with a fixed number of places. The places held never add up to more than it has. */
export class Shift {
  private pending: DomainEvent[] = [];

  private constructor(
    readonly id: ShiftId,
    readonly name: string,
    readonly places: number,
    private holds: Record<string, number>,
  ) {}

  static open(id: ShiftId, name: string, places: number): Shift {
    if (name.trim() === '') throw new ShiftError('a shift needs a name');
    if (!Number.isInteger(places) || places <= 0) throw new ShiftError('places must be a positive whole number');
    const shift = new Shift(id, name, places, {});
    shift.pending.push(new ShiftOpened(id.value, name, places));
    return shift;
  }

  static restore(state: ShiftState): Shift {
    return new Shift(state.id, state.name, state.places, { ...state.holds });
  }

  placesFree(): number {
    return this.places - Object.values(this.holds).reduce((sum, n) => sum + n, 0);
  }

  /** Holds places for a holder (a partner group, for example). */
  hold(holder: string, places: number): void {
    if (!Number.isInteger(places) || places <= 0) throw new ShiftError('places must be a positive whole number');
    if (this.holds[holder] !== undefined) throw new ShiftError(`places are already held for ${holder}`);
    const free = this.placesFree();
    if (places > free) throw new ShiftError(`not enough places: ${String(free)} free`);
    this.holds = { ...this.holds, [holder]: places };
  }

  release(holder: string): void {
    if (this.holds[holder] === undefined) throw new ShiftError(`no places are held for ${holder}`);
    const { [holder]: _released, ...rest } = this.holds;
    this.holds = rest;
  }

  state(): ShiftState {
    return { id: this.id, name: this.name, places: this.places, holds: { ...this.holds } };
  }

  pullEvents(): DomainEvent[] {
    const out = this.pending;
    this.pending = [];
    return out;
  }
}
