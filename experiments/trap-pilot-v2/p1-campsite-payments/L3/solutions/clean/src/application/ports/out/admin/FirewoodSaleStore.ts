import type { FirewoodSale } from '../../../../domain/model/admin/FirewoodSale';

export interface FirewoodSaleStore {
  add(item: FirewoodSale): Promise<void>;
  all(): Promise<FirewoodSale[]>;
}
