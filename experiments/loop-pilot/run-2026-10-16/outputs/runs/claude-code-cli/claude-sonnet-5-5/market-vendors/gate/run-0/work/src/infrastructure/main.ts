import { MarketService } from "../application/market-service";
import { createApp } from "./http";
import { HttpTillWaveGateway, startTillWavePoller } from "./tillwave";
import {
  InMemoryAuditLog,
  InMemoryBookings,
  InMemoryCardSales,
  InMemoryFeeSchedule,
  InMemoryMarketDays,
  InMemoryMerchantLinks,
  InMemoryPitches,
  InMemoryReaderLinks,
  InMemorySettlements,
  InMemoryUnitOfWork,
  InMemoryVendorBalances,
  InMemoryVendors,
} from "./in-memory";

const stores = {
  days: new InMemoryMarketDays(),
  pitches: new InMemoryPitches(),
  vendors: new InMemoryVendors(),
  bookings: new InMemoryBookings(),
  readers: new InMemoryReaderLinks(),
  merchants: new InMemoryMerchantLinks(),
  sales: new InMemoryCardSales(),
  fees: new InMemoryFeeSchedule(),
  settlements: new InMemorySettlements(),
  balances: new InMemoryVendorBalances(),
  audit: new InMemoryAuditLog(),
};
const service = new MarketService({ ...stores, uow: new InMemoryUnitOfWork(Object.values(stores)) });

const tillWaveUrl = process.env.TILLWAVE_BASE_URL;
if (tillWaveUrl) {
  startTillWavePoller(service, new HttpTillWaveGateway(tillWaveUrl, process.env.TILLWAVE_API_KEY));
}

const port = Number(process.env.PORT ?? 3000);
createApp(service).listen(port, () => console.log(`market service listening on ${port}`));
