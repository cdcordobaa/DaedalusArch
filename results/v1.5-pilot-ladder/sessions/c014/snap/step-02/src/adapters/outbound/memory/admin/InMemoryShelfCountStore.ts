import type { ShelfCountStore } from '../../../../application/ports/out/admin/ShelfCountStore';
import type { ShelfCount } from '../../../../domain/model/admin/ShelfCount';

export class InMemoryShelfCountStore implements ShelfCountStore {
  private readonly items: ShelfCount[] = [];

  async add(item: ShelfCount): Promise<void> {
    this.items.push(item);
  }

  async all(): Promise<ShelfCount[]> {
    return [...this.items];
  }
}
