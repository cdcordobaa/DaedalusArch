import type { Drop } from '../../../domain/Drop';

export interface Drops {
  nextId(): string;
  save(drop: Drop): void;
  byId(id: string): Drop | undefined;
  waitingIn(buildingId: string): Drop[];
}
