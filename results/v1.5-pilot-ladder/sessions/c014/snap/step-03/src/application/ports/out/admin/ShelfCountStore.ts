import type { ShelfCount } from '../../../../domain/model/admin/ShelfCount';

export interface ShelfCountStore {
  add(item: ShelfCount): Promise<void>;
  all(): Promise<ShelfCount[]>;
}
