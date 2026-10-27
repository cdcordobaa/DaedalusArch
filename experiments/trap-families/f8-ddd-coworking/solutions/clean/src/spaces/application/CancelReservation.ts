import type { RoomRepository } from '../domain/room/RoomRepository';
import { RoomId } from '../domain/room/value-objects/RoomId';
import { SpaceError } from '../domain/SpaceError';

export class CancelReservation {
  constructor(private readonly rooms: RoomRepository) {}

  execute(roomId: string, reservationId: string): void {
    const room = this.rooms.byId(RoomId.of(roomId));
    if (room === undefined) throw new SpaceError(`no room ${roomId}`);
    room.cancel(reservationId);
    this.rooms.save(room);
  }
}
