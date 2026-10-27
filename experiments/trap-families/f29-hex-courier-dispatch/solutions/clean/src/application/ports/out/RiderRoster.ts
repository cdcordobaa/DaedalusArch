import type { Rider } from '../../../domain/Rider';

export interface RiderRoster {
  nextId(): string;
  save(rider: Rider): void;
  find(id: string): Rider | undefined;
  list(): Rider[];
}
