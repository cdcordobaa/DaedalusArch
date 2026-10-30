import type { WorkDayStore } from '../../../../application/ports/out/admin/WorkDayStore';
import type { WorkDay } from '../../../../domain/model/admin/WorkDay';

export class InMemoryWorkDayStore implements WorkDayStore {
  private readonly items: WorkDay[] = [];

  async add(item: WorkDay): Promise<void> {
    this.items.push(item);
  }

  async all(): Promise<WorkDay[]> {
    return [...this.items];
  }
}
