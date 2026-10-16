import express from 'express';
import { InMemoryDb } from '../persistence/db';
import { HiveRepository, InspectionRepository } from '../persistence/hive-repository';
import { ApiaryService } from '../business/apiary-service';
import { ScaleRepository } from '../persistence/scale-repository';
import { TextHiveClient } from '../persistence/texthive-client';
import { ScaleService } from '../business/scale-service';
import { apiRouter, errorHandler } from './api';

const db = new InMemoryDb();
const hiveRepo = new HiveRepository(db);
const apiaries = new ApiaryService(hiveRepo, new InspectionRepository(db));
const scales = new ScaleService(hiveRepo, new ScaleRepository(db), new TextHiveClient());

const app = express();
app.use(express.json());
app.use(apiRouter(apiaries, scales));
app.use(errorHandler);
app.listen(Number(process.env.PORT ?? 3000), () => console.log('beekeepers service listening'));
