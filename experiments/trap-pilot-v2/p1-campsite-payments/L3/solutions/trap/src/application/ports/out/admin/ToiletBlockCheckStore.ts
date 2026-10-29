import type { ToiletBlockCheck } from '../../../../domain/model/admin/ToiletBlockCheck';

export interface ToiletBlockCheckStore {
  add(item: ToiletBlockCheck): Promise<void>;
  all(): Promise<ToiletBlockCheck[]>;
}
