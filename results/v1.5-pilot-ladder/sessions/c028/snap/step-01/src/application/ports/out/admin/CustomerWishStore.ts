import type { CustomerWish } from '../../../../domain/model/admin/CustomerWish';

export interface CustomerWishStore {
  add(item: CustomerWish): Promise<void>;
  all(): Promise<CustomerWish[]>;
}
