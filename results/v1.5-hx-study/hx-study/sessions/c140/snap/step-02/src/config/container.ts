import { NightdomeClient } from 'nightdome-sdk';
import { EveningController } from '../adapters/inbound/web/EveningController';
import { NightdomeSeatPlanner } from '../adapters/outbound/nightdome/NightdomeSeatPlanner';
import { EveningBookingService } from '../application/services/EveningBookingService';

/** Composition root. The Nightdome key comes from NIGHTDOME_API_KEY. */
export function createApp() {
  const dome = new NightdomeClient({ apiKey: process.env.NIGHTDOME_API_KEY ?? '', observatory: 'hilltop' });
  const web = new EveningController(new EveningBookingService(new NightdomeSeatPlanner(dome)));
  return {
    evenings: (month: string) => web.listMonth(month),
    book: (evening: string, adults: number, children: number) => web.createBooking({ evening, adults, children }),
    web,
  };
}
