import type { SterilisationRun } from '../../../../domain/model/admin/SterilisationRun';

export interface SterilisationRunStore {
  add(item: SterilisationRun): Promise<void>;
  all(): Promise<SterilisationRun[]>;
}
