import { createHttpApp } from "../adapters/inbound/http-server";
import {
  InMemoryEventRepository, InMemoryFixerRepository, InMemoryItemRepository, InMemoryVenueSmsStore,
} from "../adapters/outbound/in-memory-repositories";
import { ConsoleSmsGateway, TextLoopSmsGateway } from "../adapters/outbound/textloop-sms-gateway";
import { SpareBoxHttpGateway, UnconfiguredSpareBoxGateway } from "../adapters/outbound/sparebox-gateway";
import { RepairCafeService } from "../application/repair-cafe-service";

const port = Number(process.env.PORT ?? 3000);
const url = process.env.TEXTLOOP_URL;
const key = process.env.TEXTLOOP_API_KEY;

const spareBoxUrl = process.env.SPAREBOX_URL;
const spareBoxKey = process.env.SPAREBOX_API_KEY;

const sms = url && key ? new TextLoopSmsGateway({ baseUrl: url, apiKey: key }) : new ConsoleSmsGateway();
const service = new RepairCafeService(
  new InMemoryEventRepository(),
  new InMemoryFixerRepository(),
  new InMemoryItemRepository(),
  sms,
  spareBoxUrl && spareBoxKey
    ? new SpareBoxHttpGateway({ baseUrl: spareBoxUrl, apiKey: spareBoxKey })
    : new UnconfiguredSpareBoxGateway(),
  new InMemoryVenueSmsStore(),
  (m) => console.error(m),
);

createHttpApp(service).listen(port, () => console.log(`Repair café listening on ${port}`));
