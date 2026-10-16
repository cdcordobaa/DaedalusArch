import { ShelterService } from "../application/shelter-service.js";
import { createHttpApp } from "../adapters/inbound/http-server.js";
import { FakeMailSender } from "../adapters/outbound/fake-mail-sender.js";
import {
  InMemoryAnimalRepository,
  InMemoryApplicationRepository,
  InMemoryAuditStore,
  InMemoryCarerRepository,
  InMemoryNotificationRepository,
  InMemoryPlacementRepository,
} from "../adapters/outbound/in-memory-repositories.js";
import { FakeSmsSender, TextBridgeSmsSender } from "../adapters/outbound/textbridge-sms-sender.js";
import { SystemClock, UuidGenerator } from "../adapters/outbound/system.js";

const mailbox = new FakeMailSender();
const ids = new UuidGenerator();
const animals = new InMemoryAnimalRepository();
const applications = new InMemoryApplicationRepository();
const placements = new InMemoryPlacementRepository();
const notifications = new InMemoryNotificationRepository();
const audit = new InMemoryAuditStore(animals, applications, placements, notifications, ids);
const service = new ShelterService(
  animals,
  applications,
  mailbox,
  ids,
  new SystemClock(),
  new InMemoryCarerRepository(),
  placements,
  process.env.TEXTBRIDGE_URL
    ? new TextBridgeSmsSender(process.env.TEXTBRIDGE_URL, process.env.TEXTBRIDGE_API_KEY)
    : new FakeSmsSender(),
  notifications,
  audit,
  audit,
);

const port = Number(process.env.PORT ?? 3000);
createHttpApp(service, mailbox).listen(port, () => {
  console.log(`Shelter service listening on port ${port}`);
});
