import { FoodBankService } from '../application/food-bank-service';
import { DonationImportService } from '../application/donation-import-service';
import {
  MemoryBookingRepository,
  MemoryCategoryMappingRepository,
  MemoryHouseholdRepository,
  MemoryImportLog,
  MemoryInventoryRepository,
  MemoryPickupRepository,
} from '../adapters/outbound/memory-store';
import { FreshLinkClient } from '../adapters/outbound/freshlink-client';
import { foodBankRoutes } from '../adapters/inbound/routes';
import { donationRoutes } from '../adapters/inbound/donation-routes';
import { createServer } from '../adapters/inbound/server';
import { scheduleDaily } from '../adapters/inbound/daily-scheduler';

const households = new MemoryHouseholdRepository();
const inventory = new MemoryInventoryRepository();
const bookings = new MemoryBookingRepository();
const pickups = new MemoryPickupRepository();

const foodBank = new FoodBankService(households, inventory, bookings, pickups);
const donations = new DonationImportService(
  new FreshLinkClient(process.env.FRESHLINK_URL ?? 'https://api.freshlink.example', process.env.FRESHLINK_TOKEN ?? ''),
  new MemoryCategoryMappingRepository(),
  inventory,
  new MemoryImportLog(),
);

scheduleDaily(6, () => donations.importYesterday());

createServer(foodBankRoutes(foodBank), donationRoutes(donations)).listen(Number(process.env.PORT ?? 3000), () =>
  console.log('food bank service listening'),
);
