import { OrganiserUseCases } from './application/use-cases/organiser';
import { BookingUseCases } from './application/use-cases/booking';
import { SalesUseCases } from './application/use-cases/sales';
import { FeeUseCases } from './application/use-cases/fees';
import { SettlementUseCase } from './application/use-cases/settlement';
import { AuditTrail } from './application/use-cases/audit';
import { StatementUseCase } from './application/use-cases/statement';
import {
  MemoryAuditRepo, MemoryBalanceRepo, MemoryBookingRepo, MemoryFeeRepo, MemoryMarketDayRepo, MemoryMerchantRepo,
  MemoryReaderRepo, MemoryRepo, MemorySaleRepo, MemoryUnitOfWork, uuids,
} from './infrastructure/repositories/memory';
import { Settlement } from './domain/entities/settlement';
import { Pitch } from './domain/entities/pitch';
import { Vendor } from './domain/entities/vendor';
import { createApp } from './interface/http/app';
import { TillWavePoller } from './infrastructure/tillwave/poller';

const days = new MemoryMarketDayRepo();
const pitches = new MemoryRepo<Pitch>();
const vendors = new MemoryRepo<Vendor>();
const bookings = new MemoryBookingRepo();
const readers = new MemoryReaderRepo();
const merchants = new MemoryMerchantRepo();
const sales = new MemorySaleRepo();
const fees = new MemoryFeeRepo();
const balances = new MemoryBalanceRepo();
const settlements = new MemoryRepo<Settlement>();
const auditRepo = new MemoryAuditRepo();
const clock = { now: () => new Date() };
const uow = new MemoryUnitOfWork([days, bookings, sales, fees, balances, settlements, auditRepo]);
const audit = new AuditTrail(auditRepo, uuids, clock);
const salesUseCases = new SalesUseCases(days, readers, bookings, sales, uuids, merchants, audit, uow);

createApp({
  organiser: new OrganiserUseCases(days, pitches, vendors, readers, uuids),
  booking: new BookingUseCases(days, pitches, vendors, bookings, uuids, clock, audit, uow),
  sales: salesUseCases,
  fees: new FeeUseCases(fees, audit, uow),
  settlement: new SettlementUseCase(days, pitches, bookings, sales, fees, balances, settlements, clock, audit, uow),
  audit,
  statements: new StatementUseCase(vendors, days, bookings, sales, settlements, balances),
}).listen(Number(process.env.PORT ?? 3000));

new TillWavePoller(salesUseCases, process.env.TILLWAVE_URL ?? 'https://api.tillwave.example', process.env.TILLWAVE_KEY ?? '').start();
