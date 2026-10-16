import { Shelter } from '../application/shelter';
import { Fostering } from '../application/fostering';
import { MemoryAnimals, MemoryApplications, MemoryCarers, MemoryPlacements } from '../adapters/outbound/memory/repositories';
import { RecordingMailProvider } from '../adapters/outbound/mail/recording-mail';
import { clock, ids } from '../adapters/outbound/system';
import { createServer, errors } from '../adapters/inbound/http/server';
import { fosterRoutes } from '../adapters/inbound/http/foster-routes';

const mail = new RecordingMailProvider();
const animals = new MemoryAnimals();
const shelter = new Shelter(animals, new MemoryApplications(), mail, clock, ids);
const fostering = new Fostering(animals, new MemoryCarers(), new MemoryPlacements(), mail, clock, ids);
shelter.whenAdopted((id, name) => fostering.onAdopted(id, name));

const app = createServer(shelter);
fosterRoutes(app, fostering);
app.get('/_mail', (_req, res) => { res.json(mail.messages); });
app.use(errors);
app.listen(Number(process.env.PORT ?? 3000));
