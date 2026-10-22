import type { Queryable, QueryResult } from 'sqlwell';
import { Room } from '../../../domain/model/Room';
import type { RoomRepository } from '../../../application/ports/out/RoomRepository';

interface RoomRow { id: string; number: string; capacity: number }

export class PostgresRoomRepository implements RoomRepository {
  constructor(private readonly db: Queryable) {}

  async page(offset: number, limit: number): Promise<Room[]> {
    const result: QueryResult<RoomRow> = await this.db.query<RoomRow>('select * from rooms order by number offset $1 limit $2', [offset, limit]);
    return result.rows.map((r) => new Room(r.id, r.number, r.capacity));
  }
}
