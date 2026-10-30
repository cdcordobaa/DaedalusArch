import type { WorkDay } from '../../../domain/model/admin/WorkDay';
import type { WorkDayStore } from '../../ports/out/admin/WorkDayStore';

/** Staff-side list of a shared work day on the paths */
export class WorkDayService {
  constructor(private readonly store: WorkDayStore) {}

  async add(id: string, text: string, at: string): Promise<WorkDay> {
    if (text.trim() === '') throw new Error('text is required');
    const item: WorkDay = { id, text: text.trim(), at };
    await this.store.add(item);
    return item;
  }

  async list(): Promise<WorkDay[]> {
    return (await this.store.all()).slice().sort((x, y) => x.at.localeCompare(y.at));
  }
}
