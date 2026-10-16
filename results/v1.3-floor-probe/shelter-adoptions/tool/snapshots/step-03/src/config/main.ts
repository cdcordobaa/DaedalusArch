import { AnimalService } from '../application/animal-service';
import { AdoptionService } from '../application/adoption-service';
import { FosterService } from '../application/foster-service';
import {
  InMemoryAnimalRepository,
  InMemoryApplicationRepository,
  InMemoryCarerRepository,
  InMemoryNotificationRepository,
  InMemoryPlacementRepository,
} from '../adapters/outbound/in-memory-repositories';
import { FakeMailer } from '../adapters/outbound/fake-mailer';
import { TextBridgeSmsGateway } from '../adapters/outbound/textbridge-sms-gateway';
import { NotificationService } from '../application/notification-service';
import { UuidGenerator } from '../adapters/outbound/uuid-generator';
import { createHttpApp } from '../adapters/inbound/http-app';

const ids = new UuidGenerator();
const animalRepo = new InMemoryAnimalRepository();
const applicationRepo = new InMemoryApplicationRepository();
const carerRepo = new InMemoryCarerRepository();
const placementRepo = new InMemoryPlacementRepository();
export const mailer = new FakeMailer();
const sms = new TextBridgeSmsGateway(
  process.env.TEXTBRIDGE_URL ?? 'https://api.textbridge.example',
  process.env.TEXTBRIDGE_API_KEY ?? '',
  process.env.TEXTBRIDGE_CALLBACK_URL ?? 'http://localhost:3000/webhooks/textbridge',
);
const notifications = new NotificationService(mailer, sms, new InMemoryNotificationRepository(), ids);

const app = createHttpApp({
  animals: new AnimalService(animalRepo, ids),
  adoptions: new AdoptionService(animalRepo, applicationRepo, notifications, ids, placementRepo, carerRepo),
  foster: new FosterService(carerRepo, placementRepo, animalRepo, ids),
  notifications,
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`Shelter service listening on ${port}`));
