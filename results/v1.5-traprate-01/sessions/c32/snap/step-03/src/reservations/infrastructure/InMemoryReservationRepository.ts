import type { Outbox } from '../../messaging/Outbox';
import type { DomainEvent } from '../../shared-kernel/DomainEvent';
import { Reservation, type ReservationState } from '../domain/reservation/Reservation';
import type { ReservationRepository } from '../domain/reservation/ReservationRepository';
import { ReservationId } from '../domain/reservation/value-objects/ReservationId';

/** Reservations and their outbox in one store: saving a reservation stores its pending events in the same step. */
export class InMemoryReservationRepository implements ReservationRepository, Outbox {
  private readonly rows = new Map<string, ReservationState>();
  private outbox: DomainEvent[] = [];
  private sequence = 0;

  nextId(): ReservationId {
    this.sequence += 1;
    return ReservationId.of(`R-${String(this.sequence).padStart(4, '0')}`);
  }

  byId(id: ReservationId): Reservation | undefined {
    const row = this.rows.get(id.value);
    return row === undefined ? undefined : Reservation.restore(row);
  }

  byCarPark(carParkId: string): Reservation[] {
    return [...this.rows.values()].filter((row) => row.carParkId === carParkId).map((row) => Reservation.restore(row));
  }

  save(reservation: Reservation): void {
    const events = reservation.pullEvents();
    this.rows.set(reservation.id.value, reservation.state());
    this.outbox = [...this.outbox, ...events];
  }

  takePending(): DomainEvent[] {
    const out = this.outbox;
    this.outbox = [];
    return out;
  }
}
