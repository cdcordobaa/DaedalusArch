import { RoomSlot } from '../domain/room/RoomSlot';
import { RehearsalRoom } from '../domain/room/RehearsalRoom';
import { RehearsalRoomRepository } from '../domain/room/RehearsalRoomRepository';

export class InMemoryRehearsalRoomRepository implements RehearsalRoomRepository {
  private readonly rows = new Map<string, RehearsalRoom>();
  private readonly slotRows = new Map<string, RoomSlot[]>();

  async findById(id: string): Promise<RehearsalRoom | undefined> {
    return this.rows.get(id);
  }

  async save(room: RehearsalRoom): Promise<void> {
    this.rows.set(room.id, room);
  }

  async saveWithSlots(room: RehearsalRoom): Promise<void> {
    this.rows.set(room.id, room);
    this.slotRows.set(room.id, [...room.slots]);
  }
}
