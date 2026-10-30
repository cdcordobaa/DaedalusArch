import type { VaseLoan } from '../../../../domain/model/admin/VaseLoan';

export interface VaseLoanStore {
  add(item: VaseLoan): Promise<void>;
  all(): Promise<VaseLoan[]>;
}
