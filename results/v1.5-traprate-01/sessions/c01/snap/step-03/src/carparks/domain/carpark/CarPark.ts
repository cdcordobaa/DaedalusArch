import type { DomainEvent } from '../../../shared-kernel/DomainEvent';
import { CarParkError } from '../CarParkError';
import { CarParkOpened } from './events/CarParkOpened';
import type { CarParkId } from './value-objects/CarParkId';

export interface CarParkState {
  readonly id: CarParkId;
  readonly name: string;
  readonly bays: number;
  /** Bays held, by holder. */
  readonly holds: Readonly<Record<string, number>>;
  readonly closed: boolean;
}

/** One car park with a fixed number of bays. The bays held never add up to more than it has. */
export class CarPark {
  private pending: DomainEvent[] = [];

  private constructor(
    readonly id: CarParkId,
    readonly name: string,
    readonly bays: number,
    private holds: Record<string, number>,
    private closed = false,
  ) {}

  static open(id: CarParkId, name: string, bays: number): CarPark {
    if (name.trim() === '') throw new CarParkError('a car park needs a name');
    if (!Number.isInteger(bays) || bays <= 0) throw new CarParkError('bays must be a positive whole number');
    const carPark = new CarPark(id, name, bays, {});
    carPark.pending.push(new CarParkOpened(id.value, name, bays));
    return carPark;
  }

  static restore(state: CarParkState): CarPark {
    return new CarPark(state.id, state.name, state.bays, { ...state.holds }, state.closed);
  }

  isClosed(): boolean {
    return this.closed;
  }

  close(): void {
    this.closed = true;
  }

  baysFree(): number {
    return this.bays - Object.values(this.holds).reduce((sum, n) => sum + n, 0);
  }

  /** Holds bays for a holder (a company with a contract, for example). */
  hold(holder: string, bays: number): void {
    if (!Number.isInteger(bays) || bays <= 0) throw new CarParkError('bays must be a positive whole number');
    if (this.holds[holder] !== undefined) throw new CarParkError(`bays are already held for ${holder}`);
    const free = this.baysFree();
    if (bays > free) throw new CarParkError(`not enough bays: ${String(free)} free`);
    this.holds = { ...this.holds, [holder]: bays };
  }

  /** Holds bays only if enough are free; says whether it did. */
  tryHold(holder: string, bays: number): boolean {
    if (this.closed || this.holds[holder] !== undefined || bays > this.baysFree()) return false;
    this.hold(holder, bays);
    return true;
  }

  release(holder: string): void {
    if (this.holds[holder] === undefined) throw new CarParkError(`no bays are held for ${holder}`);
    const { [holder]: _released, ...rest } = this.holds;
    this.holds = rest;
  }

  state(): CarParkState {
    return { id: this.id, name: this.name, bays: this.bays, holds: { ...this.holds }, closed: this.closed };
  }

  pullEvents(): DomainEvent[] {
    const out = this.pending;
    this.pending = [];
    return out;
  }
}
