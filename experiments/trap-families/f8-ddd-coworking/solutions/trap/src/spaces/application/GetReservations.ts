import type { RoomRepository } from '../domain/room/RoomRepository';
import { RoomId } from '../domain/room/value-objects/RoomId';
import { SpaceError } from '../domain/SpaceError';

export interface ReservationLine {
  readonly reservationId: string;
  readonly teamId: string;
  readonly people: number;
  readonly start: string;
  readonly end: string;
}

export class GetReservations {
  constructor(private readonly rooms: RoomRepository) {}

  execute(roomId: string): ReservationLine[] {
    const room = this.rooms.byId(RoomId.of(roomId));
    if (room === undefined) throw new SpaceError(`no room ${roomId}`);
    return room.reservations().map((r) => ({ reservationId: r.id, teamId: r.teamId, people: r.people, start: r.slot.start, end: r.slot.end }));
  }
}
