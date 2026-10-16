import express from 'express';
import { InMemoryDb } from '../persistence/db';
import { HiveRepository, InspectionRepository } from '../persistence/hive-repository';
import { ApiaryService } from '../business/apiary-service';
import { apiRouter, errorHandler } from './api';

const db = new InMemoryDb();
const apiaries = new ApiaryService(new HiveRepository(db), new InspectionRepository(db));

const app = express();
app.use(express.json());
app.use(apiRouter(apiaries));
app.use(errorHandler);
app.listen(Number(process.env.PORT ?? 3000), () => console.log('beekeepers service listening'));
