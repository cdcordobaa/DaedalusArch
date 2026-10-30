import type { LostItemStore } from '../../../../application/ports/out/admin/LostItemStore';
import type { LostItem } from '../../../../domain/model/admin/LostItem';

export class InMemoryLostItemStore implements LostItemStore {
  private readonly items: LostItem[] = [];

  async add(item: LostItem): Promise<void> {
    this.items.push(item);
  }

  async all(): Promise<LostItem[]> {
    return [...this.items];
  }
}
