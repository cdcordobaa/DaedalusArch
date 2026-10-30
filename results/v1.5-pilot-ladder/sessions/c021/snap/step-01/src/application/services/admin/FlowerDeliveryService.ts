import type { FlowerDelivery } from '../../../domain/model/admin/FlowerDelivery';
import type { FlowerDeliveryStore } from '../../ports/out/admin/FlowerDeliveryStore';

/** Staff-side list of a delivery of fresh flowers from the market */
export class FlowerDeliveryService {
  constructor(private readonly store: FlowerDeliveryStore) {}

  async add(id: string, text: string, at: string): Promise<FlowerDelivery> {
    if (text.trim() === '') throw new Error('text is required');
    const item: FlowerDelivery = { id, text: text.trim(), at };
    await this.store.add(item);
    return item;
  }

  async list(): Promise<FlowerDelivery[]> {
    return (await this.store.all()).slice().sort((x, y) => x.at.localeCompare(y.at));
  }
}
