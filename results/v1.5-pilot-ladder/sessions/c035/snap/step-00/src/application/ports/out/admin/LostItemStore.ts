import type { LostItem } from '../../../../domain/model/admin/LostItem';

export interface LostItemStore {
  add(item: LostItem): Promise<void>;
  all(): Promise<LostItem[]>;
}
