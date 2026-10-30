import type { BuyingVisit } from '../../../domain/model/admin/BuyingVisit';
import type { BuyingVisitStore } from '../../ports/out/admin/BuyingVisitStore';

/** Staff-side list of a visit to buy a collection of books */
export class BuyingVisitService {
  constructor(private readonly store: BuyingVisitStore) {}

  async add(id: string, text: string, at: string): Promise<BuyingVisit> {
    if (text.trim() === '') throw new Error('text is required');
    const item: BuyingVisit = { id, text: text.trim(), at };
    await this.store.add(item);
    return item;
  }

  async list(): Promise<BuyingVisit[]> {
    return (await this.store.all()).slice().sort((x, y) => x.at.localeCompare(y.at));
  }
}
