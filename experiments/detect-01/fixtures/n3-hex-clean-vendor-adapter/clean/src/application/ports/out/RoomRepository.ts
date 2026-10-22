import { Room } from '../../../domain/model/Room';

/** Driven port. */
export interface RoomRepository {
  page(offset: number, limit: number): Promise<Room[]>;
}
