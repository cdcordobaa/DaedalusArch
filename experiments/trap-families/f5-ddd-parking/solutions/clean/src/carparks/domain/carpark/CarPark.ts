import type { DomainEvent } from '../../../shared-kernel/DomainEvent';
import { CarParkError } from '../CarParkError';
import { BaysHeld } from './events/BaysHeld';
import { BaysRefused } from './events/BaysRefused';
import { CarParkOpened } from './events/CarParkOpened';
import type { CarParkId } from './value-objects/CarParkId';

export interface CarParkState {
  readonly id: CarParkId;
  readonly name: string;
  readonly bays: number;
  /** Bays held, by holder. */
  readonly holds: Readonly<Record<string, number>>;
  readonly closed?: boolean;
}

/** One car park with a fixed number of bays. The bays held never add up to more than it has. */
export class CarPark {
  private pending: DomainEvent[] = [];

  private constructor(
    readonly id: CarParkId,
    readonly name: string,
    readonly bays: number,
    private holds: Record<string, number>,
    private isClosed = false,
  ) {}

  static open(id: CarParkId, name: string, bays: number): CarPark {
    if (name.trim() === '') throw new CarParkError('a car park needs a name');
    if (!Number.isInteger(bays) || bays <= 0) throw new CarParkError('bays must be a positive whole number');
    const carPark = new CarPark(id, name, bays, {});
    carPark.pending.push(new CarParkOpened(id.value, name, bays));
    return carPark;
  }

  static restore(state: CarParkState): CarPark {
    return new CarPark(state.id, state.name, state.bays, { ...state.holds }, state.closed === true);
  }

  get closed(): boolean {
    return this.isClosed;
  }

  /** A closed car park takes no more reservations or blocks. */
  close(): void {
    this.isClosed = true;
  }

  baysFree(): number {
    return this.bays - Object.values(this.holds).reduce((sum, n) => sum + n, 0);
  }

  /** Holds bays for a holder (a company with a contract, for example). */
  hold(holder: string, bays: number): void {
    if (!Number.isInteger(bays) || bays <= 0) throw new CarParkError('bays must be a positive whole number');
    if (this.isClosed) throw new CarParkError('the car park is closed');
    if (this.holds[holder] !== undefined) throw new CarParkError(`bays are already held for ${holder}`);
    const free = this.baysFree();
    if (bays > free) throw new CarParkError(`not enough bays: ${String(free)} free`);
    this.holds = { ...this.holds, [holder]: bays };
  }

  /** Answers a reservation's request for bays: held when enough are free, refused otherwise. Asking twice changes nothing. */
  holdForReservation(reservationId: string, bays: number): void {
    if (this.holds[reservationId] !== undefined) return;
    if (this.isClosed || !Number.isInteger(bays) || bays <= 0 || bays > this.baysFree()) {
      this.pending.push(new BaysRefused(this.id.value, reservationId));
      return;
    }
    this.holds = { ...this.holds, [reservationId]: bays };
    this.pending.push(new BaysHeld(this.id.value, reservationId));
  }

  /** Frees a reservation's bays; freeing them twice changes nothing. */
  releaseForReservation(reservationId: string): void {
    if (this.holds[reservationId] === undefined) return;
    const { [reservationId]: _released, ...rest } = this.holds;
    this.holds = rest;
  }

  release(holder: string): void {
    if (this.holds[holder] === undefined) throw new CarParkError(`no bays are held for ${holder}`);
    const { [holder]: _released, ...rest } = this.holds;
    this.holds = rest;
  }

  state(): CarParkState {
    return { id: this.id, name: this.name, bays: this.bays, holds: { ...this.holds }, closed: this.isClosed };
  }

  pullEvents(): DomainEvent[] {
    const out = this.pending;
    this.pending = [];
    return out;
  }
}
