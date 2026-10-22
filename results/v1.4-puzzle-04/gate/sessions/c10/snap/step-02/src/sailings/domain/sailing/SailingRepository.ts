import type { Sailing } from './Sailing';
import type { SailingId } from './value-objects/SailingId';

export interface SailingRepository {
  nextId(): SailingId;
  byId(id: SailingId): Sailing | undefined;
  /** Stores the sailing and its pending events in one step. */
  save(sailing: Sailing): void;
}
