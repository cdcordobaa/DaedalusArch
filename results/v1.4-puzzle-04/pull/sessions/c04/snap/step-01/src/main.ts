import { JobService } from './business/services/JobService';
import { MechanicService } from './business/services/MechanicService';
import { WorkloadService } from './business/services/WorkloadService';
import { Database } from './persistence/Database';
import { JobGateway } from './persistence/JobGateway';
import { MechanicGateway } from './persistence/MechanicGateway';
import { ReportsController } from './presentation/ReportsController';
import { WorkshopController } from './presentation/WorkshopController';

export interface AppOptions {
  /** Today's date as YYYY-MM-DD; defaults to the system date. */
  readonly today?: () => string;
}

/** Composition root: returns the HTTP controllers. */
export function createApp(options: AppOptions = {}) {
  const today = options.today ?? (() => new Date().toISOString().slice(0, 10));
  const db = new Database();
  const jobGateway = new JobGateway(db);
  const mechanicGateway = new MechanicGateway(db);
  const mechanics = new MechanicService(mechanicGateway);
  const jobs = new JobService(jobGateway, mechanics);
  return {
    workshop: new WorkshopController(mechanics, jobs, today),
    reports: new ReportsController(jobGateway, new WorkloadService(jobGateway, mechanicGateway)),
  };
}
