import { RehearsalRoom } from '../domain/room/RehearsalRoom';
import { RehearsalRoomRepository } from '../domain/room/RehearsalRoomRepository';

export class InMemoryRehearsalRoomRepository implements RehearsalRoomRepository {
  private readonly rows = new Map<string, RehearsalRoom>();

  async findById(id: string): Promise<RehearsalRoom | undefined> {
    return this.rows.get(id);
  }

  async save(room: RehearsalRoom): Promise<void> {
    this.rows.set(room.id, room);
  }

  async saveBoth(first: RehearsalRoom, second: RehearsalRoom): Promise<void> {
    this.rows.set(first.id, first);
    this.rows.set(second.id, second);
  }
}
