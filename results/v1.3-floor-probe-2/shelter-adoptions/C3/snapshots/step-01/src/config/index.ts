import { Shelter } from '../application/shelter';
import { MemoryAnimals, MemoryApplications } from '../adapters/outbound/memory/repositories';
import { RecordingMailProvider } from '../adapters/outbound/mail/recording-mail';
import { clock, ids } from '../adapters/outbound/system';
import { createServer, errors } from '../adapters/inbound/http/server';

const mail = new RecordingMailProvider();
const app = createServer(new Shelter(new MemoryAnimals(), new MemoryApplications(), mail, clock, ids));
app.get('/_mail', (_req, res) => { res.json(mail.messages); });
app.use(errors);
app.listen(Number(process.env.PORT ?? 3000));
