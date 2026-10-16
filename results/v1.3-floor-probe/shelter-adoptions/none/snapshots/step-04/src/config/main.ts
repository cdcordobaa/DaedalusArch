import { AnimalService } from '../application/animal-service';
import { AdoptionService } from '../application/adoption-service';
import { FosterService } from '../application/foster-service';
import { NotificationService } from '../application/notification-service';
import { AuditService } from '../application/audit-service';
import {
  InMemoryAnimalRepository,
  InMemoryApplicationRepository,
  InMemoryAuditLogRepository,
  InMemoryCarerRepository,
  InMemoryNotificationRepository,
  InMemoryPlacementRepository,
} from '../adapters/outbound/in-memory-repositories';
import { InMemoryUnitOfWork } from '../adapters/outbound/in-memory-unit-of-work';
import { FakeMailer } from '../adapters/outbound/fake-mailer';
import { TextBridgeSmsGateway } from '../adapters/outbound/textbridge-sms-gateway';
import { UuidGenerator } from '../adapters/outbound/uuid-generator';
import { createHttpApp } from '../adapters/inbound/http-app';

const ids = new UuidGenerator();
const animalRepo = new InMemoryAnimalRepository();
const applicationRepo = new InMemoryApplicationRepository();
const carerRepo = new InMemoryCarerRepository();
const placementRepo = new InMemoryPlacementRepository();
const notificationRepo = new InMemoryNotificationRepository();
const auditRepo = new InMemoryAuditLogRepository();
const uow = new InMemoryUnitOfWork([animalRepo, applicationRepo, carerRepo, placementRepo, notificationRepo, auditRepo]);
const audit = new AuditService(auditRepo, ids);
export const mailer = new FakeMailer();
const sms = new TextBridgeSmsGateway(
  process.env.TEXTBRIDGE_URL ?? 'https://api.textbridge.example',
  process.env.TEXTBRIDGE_API_KEY ?? '',
  process.env.TEXTBRIDGE_CALLBACK_URL ?? 'http://localhost:3000/webhooks/textbridge',
);
const notifications = new NotificationService(mailer, sms, notificationRepo, ids, audit, uow);

const app = createHttpApp({
  animals: new AnimalService(animalRepo, ids, audit, uow),
  adoptions: new AdoptionService(animalRepo, applicationRepo, notifications, ids, placementRepo, carerRepo, audit, uow),
  foster: new FosterService(carerRepo, placementRepo, animalRepo, ids, audit, uow),
  notifications,
  audit,
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`Shelter service listening on ${port}`));
