import type { WorkDay } from '../../../../domain/model/admin/WorkDay';

export interface WorkDayStore {
  add(item: WorkDay): Promise<void>;
  all(): Promise<WorkDay[]>;
}
