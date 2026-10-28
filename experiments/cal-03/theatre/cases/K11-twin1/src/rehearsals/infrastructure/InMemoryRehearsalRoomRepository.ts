import { RehearsalRoom } from '../domain/room/RehearsalRoom';
import { RehearsalRoomRepository } from '../domain/room/RehearsalRoomRepository';

export class InMemoryRehearsalRoomRepository implements RehearsalRoomRepository {
  private readonly rows = new Map<string, RehearsalRoom>();
  private readonly versions = new Map<string, number>();

  async findById(id: string): Promise<RehearsalRoom | undefined> {
    return this.rows.get(id);
  }

  async save(room: RehearsalRoom): Promise<void> {
    if (room.version < (this.versions.get(room.id) ?? 0)) {
      throw new Error('stale room version');
    }
    this.versions.set(room.id, room.version);
    this.rows.set(room.id, room);
  }
}
