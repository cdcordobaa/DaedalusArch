import { GardenService } from '../application/garden-service';
import {
  InMemoryAllocationRepository,
  InMemoryGardenerRepository,
  InMemoryMeterRepository,
  InMemoryPlotRepository,
  InMemoryReadingRepository,
  InMemoryWaitingList,
  InMemoryWorkDayRepository,
} from '../adapters/outbound/in-memory';
import { PayBeeClient } from '../adapters/outbound/paybee';
import { SystemClock } from '../adapters/outbound/system-clock';
import { FakeMailer } from '../adapters/outbound/fake-mailer';
import { WaterService } from '../application/water-service';
import { WorkDayService } from '../application/work-day-service';
import { DashboardService } from '../application/dashboard-service';
import { createApp } from '../adapters/inbound/http';

const gardeners = new InMemoryGardenerRepository();
const allocations = new InMemoryAllocationRepository();
export const mailer = new FakeMailer();
const workDayRepo = new InMemoryWorkDayRepository();
const clock = new SystemClock();
const plots = new InMemoryPlotRepository();
const waitingList = new InMemoryWaitingList();
const readings = new InMemoryReadingRepository();
const garden = new GardenService(
  plots,
  gardeners,
  allocations,
  waitingList,
  new PayBeeClient(process.env.PAYBEE_URL ?? 'https://api.paybee.example', process.env.PAYBEE_KEY ?? '', process.env.PAYBEE_WEBHOOK ?? ''),
  clock,
  workDayRepo,
  mailer,
);
const workDays = new WorkDayService(workDayRepo, gardeners, mailer, clock);
const dashboard = new DashboardService(plots, allocations, gardeners, readings, workDayRepo, waitingList, clock);
const water = new WaterService(new InMemoryMeterRepository(), readings, allocations, gardeners, mailer);

// check for overdue payments every hour
setInterval(() => {
  garden.releaseOverdue().catch((e) => console.error('release failed', e));
}, 60 * 60 * 1000);

// work-day reminders once a day
setInterval(() => workDays.sendReminders(), 24 * 60 * 60 * 1000);

createApp(garden, water, workDays, dashboard).listen(Number(process.env.PORT ?? 3000), () => console.log('garden service up'));
