import type { NightdomeClient } from 'nightdome-sdk';
import { BookingRefused } from '../../../domain/errors/BookingRefused';
import type { Evening } from '../../../domain/model/Evening';
import type { SeatPlanner } from '../../../application/ports/out/SeatPlanner';

export class NightdomeSeatPlanner implements SeatPlanner {
  constructor(private readonly dome: NightdomeClient) {}

  async month(month: string): Promise<Evening[]> {
    const res = await this.dome.evenings(month);
    return res.json.map((e) => ({ evening: e.evening, seatsFree: e.seatsFree, telescope: e.telescope }));
  }

  async reserve(evening: string, seats: number, children: number): Promise<string> {
    const res = await this.dome.reserveSeats({ evening, seats, children });
    const out = res.json;
    if ('holdRef' in out) return out.holdRef;
    throw new BookingRefused(out.detail);
  }
}
