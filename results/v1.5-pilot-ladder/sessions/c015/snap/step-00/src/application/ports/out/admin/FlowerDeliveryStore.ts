import type { FlowerDelivery } from '../../../../domain/model/admin/FlowerDelivery';

export interface FlowerDeliveryStore {
  add(item: FlowerDelivery): Promise<void>;
  all(): Promise<FlowerDelivery[]>;
}
