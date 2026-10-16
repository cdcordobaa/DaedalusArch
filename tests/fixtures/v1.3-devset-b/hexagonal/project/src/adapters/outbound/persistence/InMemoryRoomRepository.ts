import { RoomRepository } from '../../../application/ports/out/RoomRepository';
import { Money } from '../../../domain/model/Money';
import { Room } from '../../../domain/model/Room';

export class InMemoryRoomRepository implements RoomRepository {
  private readonly rooms = new Map<string, Room>([
    ['r-101', new Room('r-101', '101', Money.ofCents(9_000), 2)],
    ['r-102', new Room('r-102', '102', Money.ofCents(12_000), 3)],
    ['r-201', new Room('r-201', '201', Money.ofCents(20_000), 4)],
  ]);

  async findById(id: string): Promise<Room | undefined> {
    return this.rooms.get(id);
  }

  async findAll(): Promise<Room[]> {
    return [...this.rooms.values()];
  }
}
