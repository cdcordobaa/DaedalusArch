import { AnimalService } from '../application/animal-service';
import { AdoptionService } from '../application/adoption-service';
import { FosterService } from '../application/foster-service';
import {
  InMemoryAnimalRepository,
  InMemoryApplicationRepository,
  InMemoryCarerRepository,
  InMemoryPlacementRepository,
} from '../adapters/outbound/in-memory-repositories';
import { FakeMailer } from '../adapters/outbound/fake-mailer';
import { UuidGenerator } from '../adapters/outbound/uuid-generator';
import { createHttpApp } from '../adapters/inbound/http-app';

const ids = new UuidGenerator();
const animalRepo = new InMemoryAnimalRepository();
const applicationRepo = new InMemoryApplicationRepository();
const carerRepo = new InMemoryCarerRepository();
const placementRepo = new InMemoryPlacementRepository();
export const mailer = new FakeMailer();

const app = createHttpApp({
  animals: new AnimalService(animalRepo, ids),
  adoptions: new AdoptionService(animalRepo, applicationRepo, mailer, ids, placementRepo, carerRepo),
  foster: new FosterService(carerRepo, placementRepo, animalRepo, ids),
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`Shelter service listening on ${port}`));
