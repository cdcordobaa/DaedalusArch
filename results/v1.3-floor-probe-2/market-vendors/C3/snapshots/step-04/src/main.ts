import express from 'express';
import { MarketAdmin } from './application/use-cases/market-admin';
import { VendorUseCases } from './application/use-cases/vendors';
import { CardSales } from './application/use-cases/card-sales';
import { Fees, RunSettlement } from './application/use-cases/settlement';
import { AuditLog } from './application/use-cases/audit';
import { Statements } from './application/use-cases/statements';
import {
  CounterIds, MemoryAuditRepository, MemoryBookingRepository, MemoryFeeRepository, MemoryMarketRepository,
  MemoryReaderLinkRepository, MemorySaleRepository, MemorySettlementRepository, MemoryTransaction, MemoryVendorRepository,
} from './infrastructure/persistence/memory';
import { onError, routes } from './infrastructure/http/routes';
import { TillWaveHttpClient } from './infrastructure/tillwave/client';
import { startTillWavePoller } from './infrastructure/tillwave/poller';

const ids = new CounterIds();
const clock = { now: () => new Date() };
const market = new MemoryMarketRepository();
const vendors = new MemoryVendorRepository();
const bookings = new MemoryBookingRepository();
const links = new MemoryReaderLinkRepository();
const sales = new MemorySaleRepository();
const fees = new MemoryFeeRepository();
const settlements = new MemorySettlementRepository();
const auditRepo = new MemoryAuditRepository();
const tx = new MemoryTransaction([market, vendors, bookings, links, sales, fees, settlements, auditRepo]);
const audit = new AuditLog(auditRepo, clock, ids);

const cardSales = new CardSales(market, links, bookings, sales, ids, audit, tx);
const app = express();
app.use(express.json());
app.use(routes(
  new MarketAdmin(market, vendors, bookings, links, ids),
  new VendorUseCases(market, vendors, bookings, ids, clock, audit, tx),
  cardSales,
  new Fees(fees, audit, tx),
  new RunSettlement(market, bookings, sales, fees, settlements, clock, audit, tx),
  audit,
  new Statements(market, bookings, sales, settlements),
));
app.use(onError);
startTillWavePoller(cardSales, new TillWaveHttpClient(process.env.TILLWAVE_URL ?? 'https://api.tillwave.example', process.env.TILLWAVE_TOKEN ?? ''));
app.listen(Number(process.env.PORT ?? 3000));
