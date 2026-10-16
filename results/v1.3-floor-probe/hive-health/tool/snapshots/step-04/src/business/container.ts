import { InMemoryDb } from '../persistence/db';
import { HiveRepository, InspectionRepository } from '../persistence/hive-repository';
import { ApiaryService } from './apiary-service';
import { ScaleRepository } from '../persistence/scale-repository';
import { TextHiveClient } from '../persistence/texthive-client';
import { ScaleService } from './scale-service';
import { HarvestRepository, TreatmentRepository } from '../persistence/treatment-repository';
import { TreatmentService } from './treatment-service';
import { ReportService } from './report-service';

/** Builds the business services with their persistence. */
export function createServices() {
  const db = new InMemoryDb();
  const hiveRepo = new HiveRepository(db);
  const treatmentRepo = new TreatmentRepository(db);
  const inspectionRepo = new InspectionRepository(db);
  const harvestRepo = new HarvestRepository(db);
  const treatments = new TreatmentService(hiveRepo, treatmentRepo, harvestRepo);
  const reports = new ReportService(hiveRepo, inspectionRepo, treatmentRepo, harvestRepo);
  const apiaries = new ApiaryService(hiveRepo, inspectionRepo, treatmentRepo);
  const scales = new ScaleService(hiveRepo, new ScaleRepository(db), new TextHiveClient());
  return { treatments, reports, apiaries, scales };
}
