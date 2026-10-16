import { AnimalService } from '../application/animal-service';
import { AdoptionService } from '../application/adoption-service';
import { InMemoryAnimalRepository, InMemoryApplicationRepository } from '../adapters/outbound/in-memory-repositories';
import { FakeMailer } from '../adapters/outbound/fake-mailer';
import { UuidGenerator } from '../adapters/outbound/uuid-generator';
import { createHttpApp } from '../adapters/inbound/http-app';

const ids = new UuidGenerator();
const animalRepo = new InMemoryAnimalRepository();
const applicationRepo = new InMemoryApplicationRepository();
export const mailer = new FakeMailer();

const app = createHttpApp({
  animals: new AnimalService(animalRepo, ids),
  adoptions: new AdoptionService(animalRepo, applicationRepo, mailer, ids),
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`Shelter service listening on ${port}`));
