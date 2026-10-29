import type { FlowerDeliveryStore } from '../../../../application/ports/out/admin/FlowerDeliveryStore';
import type { FlowerDelivery } from '../../../../domain/model/admin/FlowerDelivery';

export class InMemoryFlowerDeliveryStore implements FlowerDeliveryStore {
  private readonly items: FlowerDelivery[] = [];

  async add(item: FlowerDelivery): Promise<void> {
    this.items.push(item);
  }

  async all(): Promise<FlowerDelivery[]> {
    return [...this.items];
  }
}
