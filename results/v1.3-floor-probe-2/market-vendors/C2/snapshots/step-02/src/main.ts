import { OrganiserUseCases } from './application/use-cases/organiser';
import { BookingUseCases } from './application/use-cases/booking';
import { SalesUseCases } from './application/use-cases/sales';
import { FeeUseCases } from './application/use-cases/fees';
import { SettlementUseCase } from './application/use-cases/settlement';
import {
  MemoryBalanceRepo, MemoryBookingRepo, MemoryFeeRepo, MemoryMarketDayRepo, MemoryReaderRepo, MemoryRepo, MemorySaleRepo, uuids,
} from './infrastructure/repositories/memory';
import { Settlement } from './domain/entities/settlement';
import { Pitch } from './domain/entities/pitch';
import { Vendor } from './domain/entities/vendor';
import { createApp } from './interface/http/app';

const days = new MemoryMarketDayRepo();
const pitches = new MemoryRepo<Pitch>();
const vendors = new MemoryRepo<Vendor>();
const bookings = new MemoryBookingRepo();
const readers = new MemoryReaderRepo();
const sales = new MemorySaleRepo();
const fees = new MemoryFeeRepo();
const balances = new MemoryBalanceRepo();
const settlements = new MemoryRepo<Settlement>();
const clock = { now: () => new Date() };

createApp({
  organiser: new OrganiserUseCases(days, pitches, vendors, readers, uuids),
  booking: new BookingUseCases(days, pitches, vendors, bookings, uuids, clock),
  sales: new SalesUseCases(days, readers, bookings, sales, uuids),
  fees: new FeeUseCases(fees),
  settlement: new SettlementUseCase(days, pitches, bookings, sales, fees, balances, settlements, clock),
}).listen(Number(process.env.PORT ?? 3000));
