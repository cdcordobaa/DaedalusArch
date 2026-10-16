import { Shelter } from '../application/shelter';
import { Fostering } from '../application/fostering';
import { Notifier } from '../application/notifier';
import { Audit } from '../application/audit';
import {
  MemoryAnimals, MemoryApplications, MemoryCarers, MemoryChangeLog, MemoryNotifications, MemoryPlacements, MemoryUnitOfWork,
} from '../adapters/outbound/memory/repositories';
import { RecordingMailProvider } from '../adapters/outbound/mail/recording-mail';
import { TextBridgeClient } from '../adapters/outbound/textbridge/client';
import { clock, ids } from '../adapters/outbound/system';
import { createServer, errors } from '../adapters/inbound/http/server';
import { fosterRoutes } from '../adapters/inbound/http/foster-routes';
import { auditRoutes } from '../adapters/inbound/http/audit-routes';
import { textBridgeRoutes } from '../adapters/inbound/webhooks/textbridge';

const animals = new MemoryAnimals();
const applications = new MemoryApplications();
const carers = new MemoryCarers();
const placements = new MemoryPlacements();
const notifications = new MemoryNotifications();
const changes = new MemoryChangeLog();
const uow = new MemoryUnitOfWork([animals, applications, carers, placements, notifications, changes] as unknown as { m: unknown }[]);
const audit = new Audit(changes, uow, clock, ids);

const mail = new RecordingMailProvider();
const notifier = new Notifier(
  mail, new TextBridgeClient(process.env.TEXTBRIDGE_URL ?? 'https://api.textbridge.example', process.env.TEXTBRIDGE_TOKEN ?? ''),
  notifications, clock, ids, audit,
);
const shelter = new Shelter(animals, applications, notifier, clock, ids, audit);
const fostering = new Fostering(animals, carers, placements, notifier, clock, ids, audit);
shelter.whenAdopted((id, name, by) => fostering.onAdopted(id, name, by));

const app = createServer(shelter);
fosterRoutes(app, fostering);
textBridgeRoutes(app, notifier);
auditRoutes(app, audit);
app.get('/_mail', (_req, res) => { res.json(mail.messages); });
app.use(errors);
app.listen(Number(process.env.PORT ?? 3000));
