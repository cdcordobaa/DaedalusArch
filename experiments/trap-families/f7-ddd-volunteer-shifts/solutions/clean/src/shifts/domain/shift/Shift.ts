import type { DomainEvent } from '../../../shared-kernel/DomainEvent';
import { ShiftError } from '../ShiftError';
import { PlacesHeld } from './events/PlacesHeld';
import { PlacesRefused } from './events/PlacesRefused';
import { ShiftOpened } from './events/ShiftOpened';
import type { ShiftId } from './value-objects/ShiftId';

export interface ShiftState {
  readonly id: ShiftId;
  readonly name: string;
  readonly places: number;
  /** Places held, by holder. */
  readonly holds: Readonly<Record<string, number>>;
  readonly cancelled?: boolean;
}

/** One volunteer shift with a fixed number of places. The places held never add up to more than it has. */
export class Shift {
  private pending: DomainEvent[] = [];

  private constructor(
    readonly id: ShiftId,
    readonly name: string,
    readonly places: number,
    private holds: Record<string, number>,
    private isCancelled = false,
  ) {}

  static open(id: ShiftId, name: string, places: number): Shift {
    if (name.trim() === '') throw new ShiftError('a shift needs a name');
    if (!Number.isInteger(places) || places <= 0) throw new ShiftError('places must be a positive whole number');
    const shift = new Shift(id, name, places, {});
    shift.pending.push(new ShiftOpened(id.value, name, places));
    return shift;
  }

  static restore(state: ShiftState): Shift {
    return new Shift(state.id, state.name, state.places, { ...state.holds }, state.cancelled === true);
  }

  get cancelled(): boolean {
    return this.isCancelled;
  }

  /** A cancelled shift takes no more sign-ups or blocks. */
  cancel(): void {
    this.isCancelled = true;
  }

  placesFree(): number {
    return this.places - Object.values(this.holds).reduce((sum, n) => sum + n, 0);
  }

  /** Holds places for a holder (a partner group, for example). */
  hold(holder: string, places: number): void {
    if (!Number.isInteger(places) || places <= 0) throw new ShiftError('places must be a positive whole number');
    if (this.isCancelled) throw new ShiftError('the shift is cancelled');
    if (this.holds[holder] !== undefined) throw new ShiftError(`places are already held for ${holder}`);
    const free = this.placesFree();
    if (places > free) throw new ShiftError(`not enough places: ${String(free)} free`);
    this.holds = { ...this.holds, [holder]: places };
  }

  /** Answers a sign-up's request for places: held when enough are free, refused otherwise. Asking twice changes nothing. */
  holdForSignUp(signUpId: string, places: number): void {
    if (this.holds[signUpId] !== undefined) return;
    if (this.isCancelled || !Number.isInteger(places) || places <= 0 || places > this.placesFree()) {
      this.pending.push(new PlacesRefused(this.id.value, signUpId));
      return;
    }
    this.holds = { ...this.holds, [signUpId]: places };
    this.pending.push(new PlacesHeld(this.id.value, signUpId));
  }

  /** Frees a sign-up's places; freeing them twice changes nothing. */
  releaseForSignUp(signUpId: string): void {
    if (this.holds[signUpId] === undefined) return;
    const { [signUpId]: _released, ...rest } = this.holds;
    this.holds = rest;
  }

  release(holder: string): void {
    if (this.holds[holder] === undefined) throw new ShiftError(`no places are held for ${holder}`);
    const { [holder]: _released, ...rest } = this.holds;
    this.holds = rest;
  }

  state(): ShiftState {
    return { id: this.id, name: this.name, places: this.places, holds: { ...this.holds }, cancelled: this.isCancelled };
  }

  pullEvents(): DomainEvent[] {
    const out = this.pending;
    this.pending = [];
    return out;
  }
}
