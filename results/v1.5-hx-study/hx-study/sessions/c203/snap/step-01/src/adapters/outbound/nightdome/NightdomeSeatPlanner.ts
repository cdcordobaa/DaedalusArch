import type { NightdomeClient } from 'nightdome-sdk';
import { BookingRefused } from '../../../domain/errors/BookingRefused';
import { EveningFullyBooked } from '../../../domain/errors/EveningFullyBooked';
import type { Evening } from '../../../domain/model/Evening';
import type { SeatPlanner } from '../../../application/ports/out/SeatPlanner';

export class NightdomeSeatPlanner implements SeatPlanner {
  constructor(private readonly dome: NightdomeClient) {}

  async month(month: string): Promise<Evening[]> {
    const res = await this.dome.evenings(month);
    return res.json.map((e) => ({ date: e.evening, openSeats: e.seatsFree, instrument: e.telescope }));
  }

  async reserve(evening: string, seats: number, children: number): Promise<string> {
    const res = await this.dome.reserveSeats({ evening, seats, children });
    const out = res.json;
    if ('holdRef' in out) return out.holdRef;
    if (res.status === 409 && out.code === 'dome_full') throw new EveningFullyBooked();
    throw new BookingRefused(out.detail);
  }
}
