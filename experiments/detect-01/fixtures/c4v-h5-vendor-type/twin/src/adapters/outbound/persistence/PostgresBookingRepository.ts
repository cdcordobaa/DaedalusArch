import type { Queryable } from 'sqlwell';
import { Booking } from '../../../domain/model/Booking';
import { DateRange } from '../../../domain/model/DateRange';
import type { BookingRepository } from '../../../application/ports/out/BookingRepository';
import type { UnitOfWork } from '../../../application/ports/out/UnitOfWork';

interface BookingRow { id: string; room_id: string; check_in: Date; check_out: Date }

/** Outbound adapter: the vendor client stays here. */
export class PostgresBookingRepository implements BookingRepository {
  private seq = 0;

  constructor(private readonly db: Queryable) {}

  async findByRoom(roomId: string, _work?: UnitOfWork): Promise<Booking[]> {
    const result = await this.db.query<BookingRow>('select * from bookings where room_id = $1', [roomId]);
    return result.rows.map((r) => new Booking(r.id, r.room_id, new DateRange(r.check_in, r.check_out)));
  }

  async save(booking: Booking, _work?: UnitOfWork): Promise<void> {
    await this.db.query('insert into bookings (id, room_id) values ($1, $2)', [booking.id, booking.roomId]);
  }

  nextId(): string {
    this.seq += 1;
    return `b-${this.seq}`;
  }

  async inTransaction<T>(task: (work: UnitOfWork) => Promise<T>): Promise<T> {
    return task({ id: 'tx' });
  }
}
