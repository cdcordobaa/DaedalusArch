import { Shelter } from '../application/shelter';
import { Fostering } from '../application/fostering';
import { Notifier } from '../application/notifier';
import { MemoryAnimals, MemoryApplications, MemoryCarers, MemoryNotifications, MemoryPlacements } from '../adapters/outbound/memory/repositories';
import { RecordingMailProvider } from '../adapters/outbound/mail/recording-mail';
import { TextBridgeClient } from '../adapters/outbound/textbridge/client';
import { clock, ids } from '../adapters/outbound/system';
import { createServer, errors } from '../adapters/inbound/http/server';
import { fosterRoutes } from '../adapters/inbound/http/foster-routes';
import { textBridgeRoutes } from '../adapters/inbound/webhooks/textbridge';

const mail = new RecordingMailProvider();
const notifier = new Notifier(
  mail, new TextBridgeClient(process.env.TEXTBRIDGE_URL ?? 'https://api.textbridge.example', process.env.TEXTBRIDGE_TOKEN ?? ''),
  new MemoryNotifications(), clock, ids,
);
const animals = new MemoryAnimals();
const shelter = new Shelter(animals, new MemoryApplications(), notifier, clock, ids);
const fostering = new Fostering(animals, new MemoryCarers(), new MemoryPlacements(), notifier, clock, ids);
shelter.whenAdopted((id, name) => fostering.onAdopted(id, name));

const app = createServer(shelter);
fosterRoutes(app, fostering);
textBridgeRoutes(app, notifier);
app.get('/_mail', (_req, res) => { res.json(mail.messages); });
app.use(errors);
app.listen(Number(process.env.PORT ?? 3000));
