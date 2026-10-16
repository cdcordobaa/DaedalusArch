import { GardenService } from '../application/garden-service';
import {
  InMemoryAllocationRepository,
  InMemoryGardenerRepository,
  InMemoryMeterRepository,
  InMemoryPlotRepository,
  InMemoryReadingRepository,
  InMemoryWaitingList,
} from '../adapters/outbound/in-memory';
import { PayBeeClient } from '../adapters/outbound/paybee';
import { SystemClock } from '../adapters/outbound/system-clock';
import { FakeMailer } from '../adapters/outbound/fake-mailer';
import { WaterService } from '../application/water-service';
import { createApp } from '../adapters/inbound/http';

const gardeners = new InMemoryGardenerRepository();
const allocations = new InMemoryAllocationRepository();
export const mailer = new FakeMailer();
const garden = new GardenService(
  new InMemoryPlotRepository(),
  gardeners,
  allocations,
  new InMemoryWaitingList(),
  new PayBeeClient(process.env.PAYBEE_URL ?? 'https://api.paybee.example', process.env.PAYBEE_KEY ?? '', process.env.PAYBEE_WEBHOOK ?? ''),
  new SystemClock(),
);
const water = new WaterService(new InMemoryMeterRepository(), new InMemoryReadingRepository(), allocations, gardeners, mailer);

// check for overdue payments every hour
setInterval(() => {
  garden.releaseOverdue().catch((e) => console.error('release failed', e));
}, 60 * 60 * 1000);

createApp(garden, water).listen(Number(process.env.PORT ?? 3000), () => console.log('garden service up'));
