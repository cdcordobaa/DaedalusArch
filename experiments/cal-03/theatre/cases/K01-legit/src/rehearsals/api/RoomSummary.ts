import { RoomDto } from '../contracts/RoomDto';
import { RehearsalRoom } from '../domain/room/RehearsalRoom';

export function summarise(room: RehearsalRoom): RoomDto['name'] {
  return `${room.name} (${room.slots.length} slots)`;
}
