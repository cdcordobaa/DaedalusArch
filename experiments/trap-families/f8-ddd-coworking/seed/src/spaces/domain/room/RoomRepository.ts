import type { Room } from './Room';
import type { RoomId } from './value-objects/RoomId';

export interface RoomRepository {
  nextId(): RoomId;
  nextReservationId(): string;
  byId(id: RoomId): Room | undefined;
  /** Stores the room and its pending events in one step. */
  save(room: Room): void;
}
