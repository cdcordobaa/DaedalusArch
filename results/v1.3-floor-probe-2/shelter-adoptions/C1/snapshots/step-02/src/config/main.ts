import { AnimalManagementService } from '../application/animal-management';
import { AdoptionService } from '../application/adoptions';
import { FosteringService } from '../application/fostering';
import { InMemoryAnimalStore, InMemoryApplicationStore, InMemoryCarerStore, InMemoryPlacementStore } from '../adapters/outbound/in-memory-stores';
import { FakeEmailProvider } from '../adapters/outbound/fake-email';
import { systemClock, uuidFactory } from '../adapters/outbound/system';
import { httpApi } from '../adapters/inbound/http';

const animals = new InMemoryAnimalStore();
const email = new FakeEmailProvider();
const fostering = new FosteringService(animals, new InMemoryCarerStore(), new InMemoryPlacementStore(), email, systemClock, uuidFactory);
const app = httpApi(
  new AnimalManagementService(animals, uuidFactory),
  new AdoptionService(animals, new InMemoryApplicationStore(), email, systemClock, uuidFactory, fostering),
  fostering,
  (a) => a.get('/dev/outbox', (_req, res) => { res.json(email.outbox); }),
);
app.listen(Number(process.env.PORT ?? 3000));
