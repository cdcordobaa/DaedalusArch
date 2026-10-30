import type { GuidedTour } from '../../../domain/model/admin/GuidedTour';
import type { GuidedTourStore } from '../../ports/out/admin/GuidedTourStore';

/** Staff-side list of a guided tour planned for a group */
export class GuidedTourService {
  constructor(private readonly store: GuidedTourStore) {}

  async add(id: string, text: string, at: string): Promise<GuidedTour> {
    if (text.trim() === '') throw new Error('text is required');
    const item: GuidedTour = { id, text: text.trim(), at };
    await this.store.add(item);
    return item;
  }

  async list(): Promise<GuidedTour[]> {
    return (await this.store.all()).slice().sort((x, y) => x.at.localeCompare(y.at));
  }
}
