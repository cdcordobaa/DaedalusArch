import type { DomainEvent } from '../../../../shared-kernel/DomainEvent';

/** A reservation was taken over by this room; the room it came from releases it on delivery. */
export class ReservationRelocated implements DomainEvent {
  readonly type = 'ReservationRelocated';

  constructor(
    readonly relocationId: string,
    readonly reservationId: string,
    readonly fromRoomId: string,
    readonly toRoomId: string,
  ) {}
}
