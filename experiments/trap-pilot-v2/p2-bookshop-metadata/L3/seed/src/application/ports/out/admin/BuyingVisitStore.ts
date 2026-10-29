import type { BuyingVisit } from '../../../../domain/model/admin/BuyingVisit';

export interface BuyingVisitStore {
  add(item: BuyingVisit): Promise<void>;
  all(): Promise<BuyingVisit[]>;
}
