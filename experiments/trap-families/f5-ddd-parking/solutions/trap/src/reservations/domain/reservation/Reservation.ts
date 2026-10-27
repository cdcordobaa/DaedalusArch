import type { DomainEvent } from '../../../shared-kernel/DomainEvent';
import { ReservationError } from '../ReservationError';
import { ReservationRequested } from './events/ReservationRequested';
import type { ReservationId } from './value-objects/ReservationId';

export type ReservationStatus = 'requested' | 'confirmed' | 'rejected' | 'cancelled';

/** Bays one driver may reserve at once (a group arriving together). */
const MAX_BAYS = 6;

export interface ReservationState {
  readonly id: ReservationId;
  readonly driver: string;
  readonly carParkId: string;
  readonly bays: number;
  readonly status: ReservationStatus;
}

/** A driver's reservation in one car park: 1 to 6 bays. */
export class Reservation {
  private pending: DomainEvent[] = [];

  private constructor(
    readonly id: ReservationId,
    readonly driver: string,
    readonly carParkId: string,
    readonly bays: number,
    private current: ReservationStatus,
  ) {}

  static request(id: ReservationId, driver: string, carParkId: string, bays: number): Reservation {
    if (driver.trim() === '') throw new ReservationError('a reservation needs a driver name');
    if (!Number.isInteger(bays) || bays < 1 || bays > MAX_BAYS) throw new ReservationError(`a reservation is for 1 to ${String(MAX_BAYS)} bays`);
    const reservation = new Reservation(id, driver, carParkId, bays, 'requested');
    reservation.pending.push(new ReservationRequested(id.value, carParkId, driver, bays));
    return reservation;
  }

  static restore(state: ReservationState): Reservation {
    return new Reservation(state.id, state.driver, state.carParkId, state.bays, state.status);
  }

  get status(): ReservationStatus {
    return this.current;
  }

  confirm(): void {
    this.current = 'confirmed';
  }

  reject(): void {
    this.current = 'rejected';
  }

  /** Cancels a confirmed reservation; true when its bays are to be freed. */
  cancel(): boolean {
    if (this.current !== 'confirmed') return false;
    this.current = 'cancelled';
    return true;
  }

  state(): ReservationState {
    return { id: this.id, driver: this.driver, carParkId: this.carParkId, bays: this.bays, status: this.current };
  }

  pullEvents(): DomainEvent[] {
    const out = this.pending;
    this.pending = [];
    return out;
  }
}
