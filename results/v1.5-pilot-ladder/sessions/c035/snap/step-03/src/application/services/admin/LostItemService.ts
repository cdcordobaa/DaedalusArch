import type { LostItem } from '../../../domain/model/admin/LostItem';
import type { LostItemStore } from '../../ports/out/admin/LostItemStore';

/** Staff-side list of something a guest left behind */
export class LostItemService {
  constructor(private readonly store: LostItemStore) {}

  async add(id: string, text: string, at: string): Promise<LostItem> {
    if (text.trim() === '') throw new Error('text is required');
    const item: LostItem = { id, text: text.trim(), at };
    await this.store.add(item);
    return item;
  }

  async list(): Promise<LostItem[]> {
    return (await this.store.all()).slice().sort((x, y) => x.at.localeCompare(y.at));
  }
}
