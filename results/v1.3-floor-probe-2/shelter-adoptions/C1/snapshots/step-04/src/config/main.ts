import { AnimalManagementService } from '../application/animal-management';
import { AdoptionService } from '../application/adoptions';
import { FosteringService } from '../application/fostering';
import { NotificationService } from '../application/notifications';
import { AuditService } from '../application/audit';
import {
  InMemoryAnimalStore, InMemoryApplicationStore, InMemoryAuditStore, InMemoryCarerStore, InMemoryNotificationStore,
  InMemoryPlacementStore, InMemoryTransactions,
} from '../adapters/outbound/in-memory-stores';
import { FakeEmailProvider } from '../adapters/outbound/fake-email';
import { TextBridgeSms } from '../adapters/outbound/textbridge';
import { systemClock, uuidFactory } from '../adapters/outbound/system';
import { httpApi } from '../adapters/inbound/http';

const animals = new InMemoryAnimalStore();
const applications = new InMemoryApplicationStore();
const carers = new InMemoryCarerStore();
const placements = new InMemoryPlacementStore();
const notificationStore = new InMemoryNotificationStore();
const auditStore = new InMemoryAuditStore();
const tx = new InMemoryTransactions([animals, applications, carers, placements, notificationStore, auditStore] as unknown as { rows: unknown }[]);
const audit = new AuditService(auditStore, tx, systemClock, uuidFactory);

const email = new FakeEmailProvider();
const notifications = new NotificationService(
  email, new TextBridgeSms(process.env.TEXTBRIDGE_URL ?? 'https://api.textbridge.example', process.env.TEXTBRIDGE_KEY ?? ''),
  notificationStore, systemClock, uuidFactory, audit,
);
const fostering = new FosteringService(animals, carers, placements, notifications, systemClock, uuidFactory, audit);
const app = httpApi(
  new AnimalManagementService(animals, uuidFactory, audit),
  new AdoptionService(animals, applications, notifications, systemClock, uuidFactory, audit, fostering),
  fostering,
  notifications,
  audit,
  (a) => a.get('/dev/outbox', (_req, res) => { res.json(email.outbox); }),
);
app.listen(Number(process.env.PORT ?? 3000));
