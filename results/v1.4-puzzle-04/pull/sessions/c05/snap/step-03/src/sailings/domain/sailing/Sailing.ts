import type { DomainEvent } from '../../../shared-kernel/DomainEvent';
import { SailingError } from '../SailingError';
import { SailingScheduled } from './events/SailingScheduled';
import { SeatsRefused } from './events/SeatsRefused';
import { SeatsReserved } from './events/SeatsReserved';
import type { SailingId } from './value-objects/SailingId';

export interface SailingState {
  readonly id: SailingId;
  readonly route: string;
  readonly departsAt: string;
  readonly capacity: number;
  /** Seats held, by holder. */
  readonly holds: Readonly<Record<string, number>>;
  readonly cancelled?: boolean;
}

/** One departure of a ferry on a route. The seats held never add up to more than the capacity. */
export class Sailing {
  private pending: DomainEvent[] = [];

  private constructor(
    readonly id: SailingId,
    readonly route: string,
    readonly departsAt: string,
    readonly capacity: number,
    private holds: Record<string, number>,
    private cancelled = false,
  ) {}

  static schedule(id: SailingId, route: string, departsAt: string, capacity: number): Sailing {
    if (route.trim() === '') throw new SailingError('a sailing needs a route');
    if (Number.isNaN(Date.parse(departsAt))) throw new SailingError('a sailing needs a departure time');
    if (!Number.isInteger(capacity) || capacity <= 0) throw new SailingError('capacity must be a positive whole number');
    const sailing = new Sailing(id, route, departsAt, capacity, {});
    sailing.pending.push(new SailingScheduled(id.value, route, departsAt, capacity));
    return sailing;
  }

  static restore(state: SailingState): Sailing {
    return new Sailing(state.id, state.route, state.departsAt, state.capacity, { ...state.holds }, state.cancelled === true);
  }

  isCancelled(): boolean {
    return this.cancelled;
  }

  /** The operator calls the sailing off; it takes no more seats. */
  cancel(): void {
    this.cancelled = true;
  }

  seatsLeft(): number {
    return this.capacity - Object.values(this.holds).reduce((sum, n) => sum + n, 0);
  }

  /** Holds seats for a holder (a coach party, for example). */
  hold(holder: string, seats: number): void {
    if (this.cancelled) throw new SailingError('the sailing is cancelled');
    if (!Number.isInteger(seats) || seats <= 0) throw new SailingError('seats must be a positive whole number');
    if (this.holds[holder] !== undefined) throw new SailingError(`seats are already held for ${holder}`);
    const left = this.seatsLeft();
    if (seats > left) throw new SailingError(`not enough seats: ${String(left)} left`);
    this.holds = { ...this.holds, [holder]: seats };
  }

  /** Takes seats for a booking when enough are left; otherwise takes none and says so. */
  reserve(holder: string, seats: number): void {
    if (this.holds[holder] !== undefined) return;
    if (this.cancelled) {
      this.pending.push(new SeatsRefused(this.id.value, holder, seats));
      return;
    }
    if (seats > this.seatsLeft()) {
      this.pending.push(new SeatsRefused(this.id.value, holder, seats));
      return;
    }
    this.holds = { ...this.holds, [holder]: seats };
    this.pending.push(new SeatsReserved(this.id.value, holder, seats));
  }

  release(holder: string): void {
    if (this.holds[holder] === undefined) throw new SailingError(`no seats are held for ${holder}`);
    const { [holder]: _released, ...rest } = this.holds;
    this.holds = rest;
  }

  state(): SailingState {
    return { id: this.id, route: this.route, departsAt: this.departsAt, capacity: this.capacity, holds: { ...this.holds }, cancelled: this.cancelled };
  }

  pullEvents(): DomainEvent[] {
    const out = this.pending;
    this.pending = [];
    return out;
  }
}
