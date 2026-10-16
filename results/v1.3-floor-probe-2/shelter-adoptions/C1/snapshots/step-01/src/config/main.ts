import { AnimalManagementService } from '../application/animal-management';
import { AdoptionService } from '../application/adoptions';
import { InMemoryAnimalStore, InMemoryApplicationStore } from '../adapters/outbound/in-memory-stores';
import { FakeEmailProvider } from '../adapters/outbound/fake-email';
import { systemClock, uuidFactory } from '../adapters/outbound/system';
import { httpApi } from '../adapters/inbound/http';

const animals = new InMemoryAnimalStore();
const email = new FakeEmailProvider();
const app = httpApi(
  new AnimalManagementService(animals, uuidFactory),
  new AdoptionService(animals, new InMemoryApplicationStore(), email, systemClock, uuidFactory),
  (a) => a.get('/dev/outbox', (_req, res) => { res.json(email.outbox); }),
);
app.listen(Number(process.env.PORT ?? 3000));
