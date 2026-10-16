import express from 'express';
import { ShelterService } from './application/shelter-service';
import { FosterService } from './application/foster-service';
import { NotificationService } from './application/notification-service';
import {
  InMemoryAnimalRepository, InMemoryApplicationRepository, InMemoryCarerRepository, InMemoryNotificationRepository,
  InMemoryPlacementRepository,
} from './adapters/persistence/in-memory';
import { FakeMailer } from './adapters/mail/fake-mailer';
import { TextBridgeClient } from './adapters/sms/textbridge-client';
import { SequentialIds, systemClock } from './adapters/system';
import { errorHandler, shelterRouter } from './adapters/http/router';
import { fosterRouter } from './adapters/http/foster-router';
import { textBridgeWebhook } from './adapters/http/textbridge-webhook';

const mailer = new FakeMailer();
const ids = new SequentialIds();
const notifications = new NotificationService(
  mailer,
  new TextBridgeClient(process.env.TEXTBRIDGE_URL ?? 'https://api.textbridge.example', process.env.TEXTBRIDGE_KEY ?? ''),
  new InMemoryNotificationRepository(), systemClock, ids,
);
const animals = new InMemoryAnimalRepository();
const foster = new FosterService(animals, new InMemoryCarerRepository(), new InMemoryPlacementRepository(), notifications, systemClock, ids);
const shelter = new ShelterService(animals, new InMemoryApplicationRepository(), notifications, systemClock, ids, [
  { onAdopted: (id, name) => foster.endForAdoption(id, name) },
]);

const app = express();
app.use(express.json());
app.use(shelterRouter(shelter));
app.use(fosterRouter(foster));
app.use(textBridgeWebhook(notifications));
app.get('/outbox', (_req, res) => { res.json(mailer.sent); });
app.use(errorHandler);
app.listen(Number(process.env.PORT ?? 3000));
