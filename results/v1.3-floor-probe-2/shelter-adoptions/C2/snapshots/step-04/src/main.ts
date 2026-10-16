import express from 'express';
import { ShelterService } from './application/shelter-service';
import { FosterService } from './application/foster-service';
import { NotificationService } from './application/notification-service';
import { Auditor } from './application/auditor';
import {
  InMemoryAnimalRepository, InMemoryApplicationRepository, InMemoryCarerRepository, InMemoryNotificationRepository,
  InMemoryPlacementRepository,
} from './adapters/persistence/in-memory';
import { InMemoryAuditRepository, InMemoryUnitOfWork } from './adapters/persistence/memory-store';
import { FakeMailer } from './adapters/mail/fake-mailer';
import { TextBridgeClient } from './adapters/sms/textbridge-client';
import { SequentialIds, systemClock } from './adapters/system';
import { errorHandler, shelterRouter } from './adapters/http/router';
import { fosterRouter } from './adapters/http/foster-router';
import { textBridgeWebhook } from './adapters/http/textbridge-webhook';
import { auditRouter } from './adapters/http/audit-router';

const mailer = new FakeMailer();
const ids = new SequentialIds();
const animals = new InMemoryAnimalRepository();
const applications = new InMemoryApplicationRepository();
const carers = new InMemoryCarerRepository();
const placements = new InMemoryPlacementRepository();
const notificationRepo = new InMemoryNotificationRepository();
const auditRepo = new InMemoryAuditRepository();
const uow = new InMemoryUnitOfWork([animals, applications, carers, placements, notificationRepo, auditRepo]);
const auditor = new Auditor(auditRepo, systemClock, ids);

const notifications = new NotificationService(
  mailer,
  new TextBridgeClient(process.env.TEXTBRIDGE_URL ?? 'https://api.textbridge.example', process.env.TEXTBRIDGE_KEY ?? ''),
  notificationRepo, systemClock, ids, auditor, uow,
);
const foster = new FosterService(animals, carers, placements, notifications, systemClock, ids, auditor, uow);
const shelter = new ShelterService(animals, applications, notifications, systemClock, ids, auditor, uow, [
  { onAdopted: (id, name, actor) => foster.endForAdoption(id, name, actor) },
]);

const app = express();
app.use(express.json());
app.use(shelterRouter(shelter));
app.use(fosterRouter(foster));
app.use(textBridgeWebhook(notifications));
app.use(auditRouter(auditor));
app.get('/outbox', (_req, res) => { res.json(mailer.sent); });
app.use(errorHandler);
app.listen(Number(process.env.PORT ?? 3000));
