import { GardenService } from '../application/garden-service';
import {
  InMemoryAllocationRepository,
  InMemoryGardenerRepository,
  InMemoryPlotRepository,
  InMemoryWaitingList,
} from '../adapters/outbound/in-memory';
import { PayBeeClient } from '../adapters/outbound/paybee';
import { SystemClock } from '../adapters/outbound/system-clock';
import { createApp } from '../adapters/inbound/http';

const garden = new GardenService(
  new InMemoryPlotRepository(),
  new InMemoryGardenerRepository(),
  new InMemoryAllocationRepository(),
  new InMemoryWaitingList(),
  new PayBeeClient(process.env.PAYBEE_URL ?? 'https://api.paybee.example', process.env.PAYBEE_KEY ?? '', process.env.PAYBEE_WEBHOOK ?? ''),
  new SystemClock(),
);

// check for overdue payments every hour
setInterval(() => {
  garden.releaseOverdue().catch((e) => console.error('release failed', e));
}, 60 * 60 * 1000);

createApp(garden).listen(Number(process.env.PORT ?? 3000), () => console.log('garden service up'));
