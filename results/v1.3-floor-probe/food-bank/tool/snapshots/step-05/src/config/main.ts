import { FoodBankService } from '../application/food-bank-service';
import { DonationImportService } from '../application/donation-import-service';
import {
  MemoryBookingRepository,
  MemoryCategoryMappingRepository,
  MemoryDonationReceiptRepository,
  MemoryHouseholdRepository,
  MemoryImportLog,
  MemoryInventoryRepository,
  MemoryPickupRepository,
} from '../adapters/outbound/memory-store';
import { FreshLinkClient } from '../adapters/outbound/freshlink-client';
import { SnapTextSmsSender } from '../adapters/outbound/snaptext-sms';
import { FakeMailer } from '../adapters/outbound/fake-mailer';
import { AttendanceService } from '../application/attendance-service';
import { NetworkReportService } from '../application/network-report-service';
import { reportRoutes } from '../adapters/inbound/report-routes';
import { foodBankRoutes } from '../adapters/inbound/routes';
import { donationRoutes } from '../adapters/inbound/donation-routes';
import { createServer } from '../adapters/inbound/server';
import { scheduleDaily } from '../adapters/inbound/daily-scheduler';

const households = new MemoryHouseholdRepository();
const inventory = new MemoryInventoryRepository();
const bookings = new MemoryBookingRepository();
const pickups = new MemoryPickupRepository();
const receipts = new MemoryDonationReceiptRepository();

const foodBank = new FoodBankService(households, inventory, bookings, pickups);
const donations = new DonationImportService(
  new FreshLinkClient(process.env.FRESHLINK_URL ?? 'https://api.freshlink.example', process.env.FRESHLINK_TOKEN ?? ''),
  new MemoryCategoryMappingRepository(),
  inventory,
  new MemoryImportLog(),
  receipts,
);
const reports = new NetworkReportService(receipts, pickups, inventory, households);

export const mailer = new FakeMailer();
const attendance = new AttendanceService(
  households,
  bookings,
  pickups,
  new SnapTextSmsSender(process.env.SNAPTEXT_URL ?? 'https://api.snaptext.example', process.env.SNAPTEXT_KEY ?? ''),
  mailer,
  () => (process.env.STAFF_ON_DUTY ?? 'duty@foodbank.example').split(','),
);

const isoDate = (offsetDays: number): string => new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10);

scheduleDaily(6, () => donations.importYesterday());
scheduleDaily(18, () => attendance.sendReminders(isoDate(1)));
scheduleDaily(23, () => attendance.checkMissedPickups(isoDate(0)));

createServer(foodBankRoutes(foodBank), donationRoutes(donations), reportRoutes(reports)).listen(Number(process.env.PORT ?? 3000), () =>
  console.log('food bank service listening'),
);
