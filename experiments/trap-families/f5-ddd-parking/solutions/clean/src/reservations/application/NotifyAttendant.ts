import type { DomainEvent } from '../../shared-kernel/DomainEvent';
import type { ReservationRequested } from '../domain/reservation/events/ReservationRequested';
import type { AttendantNotices } from './ports/AttendantNotices';

/** Tells the attendants about every new reservation. */
export class NotifyAttendant {
  constructor(private readonly notices: AttendantNotices) {}

  handle(event: DomainEvent): void {
    const requested = event as ReservationRequested;
    this.notices.add(`Reservation ${requested.reservationId}: ${String(requested.bays)} bay(s) at ${requested.carParkId} for ${requested.driver}`);
  }
}
