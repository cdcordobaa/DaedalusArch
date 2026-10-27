import type { RoomRepository } from '../domain/room/RoomRepository';
import { RoomId } from '../domain/room/value-objects/RoomId';
import { SpaceError } from '../domain/SpaceError';

export interface HistoryLine {
  readonly kind: string;
  readonly reservationId: string;
  readonly otherRoom: string | null;
}

export class GetHistory {
  constructor(private readonly rooms: RoomRepository) {}

  execute(roomId: string): HistoryLine[] {
    const room = this.rooms.byId(RoomId.of(roomId));
    if (room === undefined) throw new SpaceError(`no room ${roomId}`);
    return room.history().map((c) => ({ kind: c.kind, reservationId: c.reservationId, otherRoom: c.otherRoom }));
  }
}
