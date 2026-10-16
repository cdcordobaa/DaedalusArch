import { FoodBankService } from '../application/food-bank-service';
import {
  MemoryBookingRepository,
  MemoryHouseholdRepository,
  MemoryInventoryRepository,
  MemoryPickupRepository,
} from '../adapters/outbound/memory-store';
import { foodBankRoutes } from '../adapters/inbound/routes';
import { createServer } from '../adapters/inbound/server';

const households = new MemoryHouseholdRepository();
const inventory = new MemoryInventoryRepository();
const bookings = new MemoryBookingRepository();
const pickups = new MemoryPickupRepository();

const foodBank = new FoodBankService(households, inventory, bookings, pickups);

createServer(foodBankRoutes(foodBank)).listen(Number(process.env.PORT ?? 3000), () => console.log('food bank service listening'));
