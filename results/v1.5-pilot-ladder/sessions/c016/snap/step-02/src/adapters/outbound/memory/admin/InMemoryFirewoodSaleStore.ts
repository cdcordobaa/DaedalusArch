import type { FirewoodSaleStore } from '../../../../application/ports/out/admin/FirewoodSaleStore';
import type { FirewoodSale } from '../../../../domain/model/admin/FirewoodSale';

export class InMemoryFirewoodSaleStore implements FirewoodSaleStore {
  private readonly items: FirewoodSale[] = [];

  async add(item: FirewoodSale): Promise<void> {
    this.items.push(item);
  }

  async all(): Promise<FirewoodSale[]> {
    return [...this.items];
  }
}
