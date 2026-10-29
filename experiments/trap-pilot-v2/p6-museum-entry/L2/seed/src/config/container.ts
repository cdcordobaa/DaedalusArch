import { CrowdgateClient } from 'crowdgate-sdk';
import { TicketController } from '../adapters/inbound/http/TicketController';
import { CrowdgateEntriesAdapter } from '../adapters/outbound/crowdgate/CrowdgateEntriesAdapter';
import { BuyTicketsService } from '../application/services/BuyTicketsService';

/** Composition root. The Crowdgate key comes from CROWDGATE_API_KEY. */
export function createApp() {
  const crowdgate = new CrowdgateClient({ apiKey: process.env.CROWDGATE_API_KEY ?? '' });
  const http = new TicketController(new BuyTicketsService(new CrowdgateEntriesAdapter(crowdgate)));
  return {
    slots: (day: string) => http.getSlots(day),
    buy: (slot: string, visitors: number) => http.postTicket({ slot, visitors }),
    http,
  };
}
