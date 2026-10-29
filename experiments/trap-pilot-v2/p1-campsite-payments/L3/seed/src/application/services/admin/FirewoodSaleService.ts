import type { FirewoodSale } from '../../../domain/model/admin/FirewoodSale';
import type { FirewoodSaleStore } from '../../ports/out/admin/FirewoodSaleStore';

/** Staff-side list of a bag of firewood sold at the shop */
export class FirewoodSaleService {
  constructor(private readonly store: FirewoodSaleStore) {}

  async add(id: string, text: string, at: string): Promise<FirewoodSale> {
    if (text.trim() === '') throw new Error('text is required');
    const item: FirewoodSale = { id, text: text.trim(), at };
    await this.store.add(item);
    return item;
  }

  async list(): Promise<FirewoodSale[]> {
    return (await this.store.all()).slice().sort((x, y) => x.at.localeCompare(y.at));
  }
}
