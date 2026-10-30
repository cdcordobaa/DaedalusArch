import type { BuyingVisitStore } from '../../../../application/ports/out/admin/BuyingVisitStore';
import type { BuyingVisit } from '../../../../domain/model/admin/BuyingVisit';

export class InMemoryBuyingVisitStore implements BuyingVisitStore {
  private readonly items: BuyingVisit[] = [];

  async add(item: BuyingVisit): Promise<void> {
    this.items.push(item);
  }

  async all(): Promise<BuyingVisit[]> {
    return [...this.items];
  }
}
