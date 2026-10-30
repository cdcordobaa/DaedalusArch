import type { ToiletBlockCheckStore } from '../../../../application/ports/out/admin/ToiletBlockCheckStore';
import type { ToiletBlockCheck } from '../../../../domain/model/admin/ToiletBlockCheck';

export class InMemoryToiletBlockCheckStore implements ToiletBlockCheckStore {
  private readonly items: ToiletBlockCheck[] = [];

  async add(item: ToiletBlockCheck): Promise<void> {
    this.items.push(item);
  }

  async all(): Promise<ToiletBlockCheck[]> {
    return [...this.items];
  }
}
