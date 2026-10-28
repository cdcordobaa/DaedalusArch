import { RoomSlot } from '../domain/room/RoomSlot';

export interface RoomDto {
  id: string;
  name: string;
  slots: RoomSlot[];
}
