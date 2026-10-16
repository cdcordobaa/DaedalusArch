import { AnimalService } from "../application/animal-service.js";
import { ApplicationService } from "../application/application-service.js";
import { AuditService } from "../application/audit-service.js";
import { InMemoryAuditLog, InMemoryChangeStore } from "../adapters/outbound/in-memory-audit.js";
import { createHttpServer } from "../adapters/inbound/http-server.js";
import { FakeMailProvider } from "../adapters/outbound/fake-mail-provider.js";
import { FosterService } from "../application/foster-service.js";
import { NotificationService } from "../application/notification-service.js";
import { FakeSmsProvider, TextBridgeSmsProvider } from "../adapters/outbound/sms-providers.js";
import {
  InMemoryNotificationRepository,
  InMemoryAnimalRepository,
  InMemoryApplicationRepository,
  InMemoryFosterCarerRepository,
  InMemoryPlacementRepository,
} from "../adapters/outbound/in-memory-repositories.js";
import { SystemClock, UuidGenerator } from "../adapters/outbound/system-support.js";

const animalRepo = new InMemoryAnimalRepository();
const applicationRepo = new InMemoryApplicationRepository();
const carerRepo = new InMemoryFosterCarerRepository();
const placementRepo = new InMemoryPlacementRepository();
const mail = new FakeMailProvider();
const ids = new UuidGenerator();
const clock = new SystemClock();
const textBridgeUrl = process.env["TEXTBRIDGE_URL"];
const fakeSms = textBridgeUrl ? undefined : new FakeSmsProvider();
const sms = textBridgeUrl
  ? new TextBridgeSmsProvider(textBridgeUrl, process.env["TEXTBRIDGE_API_KEY"])
  : fakeSms!;
const notificationRepo = new InMemoryNotificationRepository();
const auditLog = new InMemoryAuditLog();
const changes = new InMemoryChangeStore(animalRepo, applicationRepo, placementRepo, notificationRepo, auditLog, ids, clock);
const notifications = new NotificationService(mail, sms, notificationRepo, changes, ids, clock);

const server = createHttpServer({
  animals: new AnimalService(animalRepo, changes, ids),
  applications: new ApplicationService(
    animalRepo,
    applicationRepo,
    changes,
    notifications,
    ids,
    clock,
    placementRepo,
    carerRepo,
  ),
  foster: new FosterService(animalRepo, carerRepo, placementRepo, changes, ids, clock),
  notifications,
  audit: new AuditService(animalRepo, auditLog),
  sentMail: () => mail.sent(),
  sentSms: () => fakeSms?.sent() ?? [],
});

const port = Number(process.env["PORT"] ?? 3000);
server.listen(port, () => {
  console.log(`Shelter service listening on port ${port}`);
});
