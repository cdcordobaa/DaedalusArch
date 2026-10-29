import type { SterilisationRun } from '../../../domain/model/admin/SterilisationRun';
import type { SterilisationRunStore } from '../../ports/out/admin/SterilisationRunStore';

/** Staff-side list of a run of the steriliser */
export class SterilisationRunService {
  constructor(private readonly store: SterilisationRunStore) {}

  async add(id: string, text: string, at: string): Promise<SterilisationRun> {
    if (text.trim() === '') throw new Error('text is required');
    const item: SterilisationRun = { id, text: text.trim(), at };
    await this.store.add(item);
    return item;
  }

  async list(): Promise<SterilisationRun[]> {
    return (await this.store.all()).slice().sort((x, y) => x.at.localeCompare(y.at));
  }
}
