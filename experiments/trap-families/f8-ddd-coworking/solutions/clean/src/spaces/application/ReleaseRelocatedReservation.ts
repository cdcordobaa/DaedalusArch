import type { DomainEvent } from '../../shared-kernel/DomainEvent';
import type { ReservationRelocated } from '../domain/room/events/ReservationRelocated';
import type { RoomRepository } from '../domain/room/RoomRepository';
import { RoomId } from '../domain/room/value-objects/RoomId';
import { SpaceError } from '../domain/SpaceError';

export class ReleaseRelocatedReservation {
  constructor(private readonly rooms: RoomRepository) {}

  handle(event: DomainEvent): void {
    const relocated = event as ReservationRelocated;
    const source = this.rooms.byId(RoomId.of(relocated.fromRoomId));
    if (source === undefined) throw new SpaceError(`no room ${relocated.fromRoomId}`);
    source.releaseRelocated(relocated.relocationId, relocated.reservationId, RoomId.of(relocated.toRoomId));
    this.rooms.save(source);
  }
}
