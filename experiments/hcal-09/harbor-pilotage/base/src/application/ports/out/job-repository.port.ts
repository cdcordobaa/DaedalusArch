import { PilotageJob } from '../../../domain/pilotage-job';

export interface JobRepositoryPort {
  findById(id: string): Promise<PilotageJob | null>;
  findBySlotRef(slotRef: string): Promise<PilotageJob | null>;
  save(job: PilotageJob): Promise<void>;
}
