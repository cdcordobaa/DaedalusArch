import express from 'express';
import { ShelterService } from './application/shelter-service';
import { FosterService } from './application/foster-service';
import {
  InMemoryAnimalRepository, InMemoryApplicationRepository, InMemoryCarerRepository, InMemoryPlacementRepository,
} from './adapters/persistence/in-memory';
import { FakeMailer } from './adapters/mail/fake-mailer';
import { SequentialIds, systemClock } from './adapters/system';
import { errorHandler, shelterRouter } from './adapters/http/router';
import { fosterRouter } from './adapters/http/foster-router';

const mailer = new FakeMailer();
const ids = new SequentialIds();
const animals = new InMemoryAnimalRepository();
const foster = new FosterService(animals, new InMemoryCarerRepository(), new InMemoryPlacementRepository(), mailer, systemClock, ids);
const shelter = new ShelterService(animals, new InMemoryApplicationRepository(), mailer, systemClock, ids, [
  { onAdopted: (id, name) => foster.endForAdoption(id, name) },
]);

const app = express();
app.use(express.json());
app.use(shelterRouter(shelter));
app.use(fosterRouter(foster));
app.get('/outbox', (_req, res) => { res.json(mailer.sent); });
app.use(errorHandler);
app.listen(Number(process.env.PORT ?? 3000));
