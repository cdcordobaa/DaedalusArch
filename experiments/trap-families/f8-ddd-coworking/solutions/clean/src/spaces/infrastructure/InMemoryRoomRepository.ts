import type { DomainEvent } from '../../shared-kernel/DomainEvent';
import type { Outbox } from '../application/ports/Outbox';
import { Room, type RoomState } from '../domain/room/Room';
import type { RoomRepository } from '../domain/room/RoomRepository';
import { RoomId } from '../domain/room/value-objects/RoomId';

/** Rooms and their outbox in one store: saving a room stores its pending events in the same step. */
export class InMemoryRoomRepository implements RoomRepository, Outbox {
  private readonly rows = new Map<string, RoomState>();
  private outbox: DomainEvent[] = [];
  private sequence = 0;
  private reservationSequence = 0;
  private relocations = 0;

  nextId(): RoomId {
    this.sequence += 1;
    return RoomId.of(`R-${String(this.sequence).padStart(4, '0')}`);
  }

  nextReservationId(): string {
    this.reservationSequence += 1;
    return `S-${String(this.reservationSequence).padStart(4, '0')}`;
  }

  nextRelocationId(): string {
    this.relocations += 1;
    return `L-${String(this.relocations).padStart(4, '0')}`;
  }

  byId(id: RoomId): Room | undefined {
    const row = this.rows.get(id.value);
    return row === undefined ? undefined : Room.restore(row);
  }

  save(room: Room): void {
    const events = room.pullEvents();
    this.rows.set(room.id.value, room.state());
    this.outbox = [...this.outbox, ...events];
  }

  takePending(): DomainEvent[] {
    const out = this.outbox;
    this.outbox = [];
    return out;
  }
}
