import type { CustomerWishStore } from '../../../../application/ports/out/admin/CustomerWishStore';
import type { CustomerWish } from '../../../../domain/model/admin/CustomerWish';

export class InMemoryCustomerWishStore implements CustomerWishStore {
  private readonly items: CustomerWish[] = [];

  async add(item: CustomerWish): Promise<void> {
    this.items.push(item);
  }

  async all(): Promise<CustomerWish[]> {
    return [...this.items];
  }
}
