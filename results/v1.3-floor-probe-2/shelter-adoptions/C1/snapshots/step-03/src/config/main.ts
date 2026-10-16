import { AnimalManagementService } from '../application/animal-management';
import { AdoptionService } from '../application/adoptions';
import { FosteringService } from '../application/fostering';
import { NotificationService } from '../application/notifications';
import {
  InMemoryAnimalStore, InMemoryApplicationStore, InMemoryCarerStore, InMemoryNotificationStore, InMemoryPlacementStore,
} from '../adapters/outbound/in-memory-stores';
import { FakeEmailProvider } from '../adapters/outbound/fake-email';
import { TextBridgeSms } from '../adapters/outbound/textbridge';
import { systemClock, uuidFactory } from '../adapters/outbound/system';
import { httpApi } from '../adapters/inbound/http';

const animals = new InMemoryAnimalStore();
const email = new FakeEmailProvider();
const notifications = new NotificationService(
  email, new TextBridgeSms(process.env.TEXTBRIDGE_URL ?? 'https://api.textbridge.example', process.env.TEXTBRIDGE_KEY ?? ''),
  new InMemoryNotificationStore(), systemClock, uuidFactory,
);
const fostering = new FosteringService(animals, new InMemoryCarerStore(), new InMemoryPlacementStore(), notifications, systemClock, uuidFactory);
const app = httpApi(
  new AnimalManagementService(animals, uuidFactory),
  new AdoptionService(animals, new InMemoryApplicationStore(), notifications, systemClock, uuidFactory, fostering),
  fostering,
  notifications,
  (a) => a.get('/dev/outbox', (_req, res) => { res.json(email.outbox); }),
);
app.listen(Number(process.env.PORT ?? 3000));
