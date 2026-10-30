import type { ShelfCount } from '../../../domain/model/admin/ShelfCount';
import type { ShelfCountStore } from '../../ports/out/admin/ShelfCountStore';

/** Staff-side list of a count of the books on one shelf */
export class ShelfCountService {
  constructor(private readonly store: ShelfCountStore) {}

  async add(id: string, text: string, at: string): Promise<ShelfCount> {
    if (text.trim() === '') throw new Error('text is required');
    const item: ShelfCount = { id, text: text.trim(), at };
    await this.store.add(item);
    return item;
  }

  async list(): Promise<ShelfCount[]> {
    return (await this.store.all()).slice().sort((x, y) => x.at.localeCompare(y.at));
  }
}
