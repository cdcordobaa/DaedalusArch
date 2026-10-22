import type { DomainEvent } from '../../shared-kernel/DomainEvent';
import { SailingError } from '../domain/SailingError';
import type { SailingRepository } from '../domain/sailing/SailingRepository';
import { SailingId } from '../domain/sailing/value-objects/SailingId';

/** The fields of a booking cancellation that sailings cares about. */
interface BookingCancellation {
  readonly bookingId: string;
  readonly sailingId: string;
}

/** Gives back the seats of a cancelled booking. */
export class ReleaseSeatsForBooking {
  constructor(private readonly sailings: SailingRepository) {}

  handle(event: DomainEvent): void {
    const { bookingId, sailingId } = event as unknown as BookingCancellation;
    const sailing = this.sailings.byId(SailingId.of(sailingId));
    if (sailing === undefined) throw new SailingError(`no sailing ${sailingId}`);
    const holder = `booking:${bookingId}`;
    if (sailing.state().holds[holder] === undefined) return;
    sailing.release(holder);
    this.sailings.save(sailing);
  }
}
