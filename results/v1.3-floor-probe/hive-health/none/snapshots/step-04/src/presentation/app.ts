import express from 'express';
import { InMemoryDb } from '../persistence/db';
import { HiveRepository, InspectionRepository } from '../persistence/hive-repository';
import { ApiaryService } from '../business/apiary-service';
import { ScaleRepository } from '../persistence/scale-repository';
import { TextHiveClient } from '../persistence/texthive-client';
import { ScaleService } from '../business/scale-service';
import { HarvestRepository, TreatmentRepository } from '../persistence/treatment-repository';
import { TreatmentService } from '../business/treatment-service';
import { ReportService } from '../business/report-service';
import { apiRouter, errorHandler } from './api';

const db = new InMemoryDb();
const hiveRepo = new HiveRepository(db);
const treatmentRepo = new TreatmentRepository(db);
const inspectionRepo = new InspectionRepository(db);
const harvestRepo = new HarvestRepository(db);
const treatments = new TreatmentService(hiveRepo, treatmentRepo, harvestRepo);
const reports = new ReportService(hiveRepo, inspectionRepo, treatmentRepo, harvestRepo);
const apiaries = new ApiaryService(hiveRepo, inspectionRepo, treatmentRepo);
const scales = new ScaleService(hiveRepo, new ScaleRepository(db), new TextHiveClient());

const app = express();
app.use(express.json());
app.use(apiRouter(apiaries, scales, treatments, reports));
app.use(errorHandler);
app.listen(Number(process.env.PORT ?? 3000), () => console.log('beekeepers service listening'));
