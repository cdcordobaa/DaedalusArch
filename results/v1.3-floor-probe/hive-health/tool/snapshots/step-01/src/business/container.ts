import { InMemoryDb } from '../persistence/db';
import { HiveRepository, InspectionRepository } from '../persistence/hive-repository';
import { ApiaryService } from './apiary-service';

/** Builds the business services with their persistence. */
export function createServices() {
  const db = new InMemoryDb();
  const apiaries = new ApiaryService(new HiveRepository(db), new InspectionRepository(db));
  return { apiaries };
}
