import { Room } from '../domain/room/Room';
import type { RoomRepository } from '../domain/room/RoomRepository';

export class OpenRoom {
  constructor(private readonly rooms: RoomRepository) {}

  execute(name: string, site: string, seats: number): string {
    const room = Room.open(this.rooms.nextId(), name, site, seats);
    this.rooms.save(room);
    return room.id.value;
  }
}
