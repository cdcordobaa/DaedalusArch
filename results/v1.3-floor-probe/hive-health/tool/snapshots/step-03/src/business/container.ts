import { InMemoryDb } from '../persistence/db';
import { HiveRepository, InspectionRepository } from '../persistence/hive-repository';
import { ApiaryService } from './apiary-service';
import { ScaleRepository } from '../persistence/scale-repository';
import { TextHiveClient } from '../persistence/texthive-client';
import { ScaleService } from './scale-service';
import { HarvestRepository, TreatmentRepository } from '../persistence/treatment-repository';
import { TreatmentService } from './treatment-service';

/** Builds the business services with their persistence. */
export function createServices() {
  const db = new InMemoryDb();
  const hiveRepo = new HiveRepository(db);
  const treatmentRepo = new TreatmentRepository(db);
  const apiaries = new ApiaryService(hiveRepo, new InspectionRepository(db), treatmentRepo);
  const treatments = new TreatmentService(hiveRepo, treatmentRepo, new HarvestRepository(db));
  const scales = new ScaleService(hiveRepo, new ScaleRepository(db), new TextHiveClient());
  return { apiaries, treatments, scales };
}
