import type { CustomerWish } from '../../../domain/model/admin/CustomerWish';
import type { CustomerWishStore } from '../../ports/out/admin/CustomerWishStore';

/** Staff-side list of a title a customer asked us to look out for */
export class CustomerWishService {
  constructor(private readonly store: CustomerWishStore) {}

  async add(id: string, text: string, at: string): Promise<CustomerWish> {
    if (text.trim() === '') throw new Error('text is required');
    const item: CustomerWish = { id, text: text.trim(), at };
    await this.store.add(item);
    return item;
  }

  async list(): Promise<CustomerWish[]> {
    return (await this.store.all()).slice().sort((x, y) => x.at.localeCompare(y.at));
  }
}
