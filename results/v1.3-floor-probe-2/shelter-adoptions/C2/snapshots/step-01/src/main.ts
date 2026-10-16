import express from 'express';
import { ShelterService } from './application/shelter-service';
import { InMemoryAnimalRepository, InMemoryApplicationRepository } from './adapters/persistence/in-memory';
import { FakeMailer } from './adapters/mail/fake-mailer';
import { SequentialIds, systemClock } from './adapters/system';
import { errorHandler, shelterRouter } from './adapters/http/router';

const mailer = new FakeMailer();
const shelter = new ShelterService(new InMemoryAnimalRepository(), new InMemoryApplicationRepository(), mailer, systemClock, new SequentialIds());

const app = express();
app.use(express.json());
app.use(shelterRouter(shelter));
app.get('/outbox', (_req, res) => { res.json(mailer.sent); });
app.use(errorHandler);
app.listen(Number(process.env.PORT ?? 3000));
