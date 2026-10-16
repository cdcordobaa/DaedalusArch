import express from 'express';
import { MarketAdmin } from './application/use-cases/market-admin';
import { VendorUseCases } from './application/use-cases/vendors';
import { CardSales } from './application/use-cases/card-sales';
import { Fees, RunSettlement } from './application/use-cases/settlement';
import {
  CounterIds, MemoryBookingRepository, MemoryFeeRepository, MemoryMarketRepository, MemoryReaderLinkRepository,
  MemorySaleRepository, MemorySettlementRepository, MemoryVendorRepository,
} from './infrastructure/persistence/memory';
import { onError, routes } from './infrastructure/http/routes';
import { TillWaveHttpClient } from './infrastructure/tillwave/client';
import { startTillWavePoller } from './infrastructure/tillwave/poller';

const ids = new CounterIds();
const market = new MemoryMarketRepository();
const vendors = new MemoryVendorRepository();
const bookings = new MemoryBookingRepository();
const links = new MemoryReaderLinkRepository();
const sales = new MemorySaleRepository();
const fees = new MemoryFeeRepository();
const settlements = new MemorySettlementRepository();
const clock = { now: () => new Date() };

const app = express();
app.use(express.json());
const cardSales = new CardSales(market, links, bookings, sales, ids);
app.use(routes(
  new MarketAdmin(market, vendors, bookings, links, ids),
  new VendorUseCases(market, vendors, bookings, ids, clock),
  cardSales,
  new Fees(fees),
  new RunSettlement(market, bookings, sales, fees, settlements, clock),
));
app.use(onError);
startTillWavePoller(cardSales, new TillWaveHttpClient(process.env.TILLWAVE_URL ?? 'https://api.tillwave.example', process.env.TILLWAVE_TOKEN ?? ''));
app.listen(Number(process.env.PORT ?? 3000));
