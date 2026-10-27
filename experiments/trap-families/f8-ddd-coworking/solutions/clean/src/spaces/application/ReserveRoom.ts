import type { RoomRepository } from '../domain/room/RoomRepository';
import { RoomId } from '../domain/room/value-objects/RoomId';
import { TimeSlot } from '../domain/room/value-objects/TimeSlot';
import { SpaceError } from '../domain/SpaceError';

export class ReserveRoom {
  constructor(private readonly rooms: RoomRepository) {}

  execute(roomId: string, teamId: string, people: number, start: string, end: string): string {
    const room = this.rooms.byId(RoomId.of(roomId));
    if (room === undefined) throw new SpaceError(`no room ${roomId}`);
    const reservationId = this.rooms.nextReservationId();
    room.reserve(reservationId, teamId, people, TimeSlot.of(start, end));
    this.rooms.save(room);
    return reservationId;
  }
}
