import type { RoomRepository } from '../domain/room/RoomRepository';
import { RoomId } from '../domain/room/value-objects/RoomId';
import { SpaceError } from '../domain/SpaceError';

/** Puts the reservation in the receiving room; `ReleaseRelocatedReservation` takes it out of the leaving room on delivery. */
export class RelocateReservation {
  constructor(private readonly rooms: RoomRepository) {}

  execute(reservationId: string, fromRoomId: string, toRoomId: string): string {
    const source = this.rooms.byId(RoomId.of(fromRoomId));
    if (source === undefined) throw new SpaceError(`no room ${fromRoomId}`);
    const target = this.rooms.byId(RoomId.of(toRoomId));
    if (target === undefined) throw new SpaceError(`no room ${toRoomId}`);
    const reservation = source.reservation(reservationId);
    const relocationId = this.rooms.nextRelocationId();
    target.takeOverReservation(relocationId, reservation, source.id, source.site);
    this.rooms.save(target);
    return relocationId;
  }
}
