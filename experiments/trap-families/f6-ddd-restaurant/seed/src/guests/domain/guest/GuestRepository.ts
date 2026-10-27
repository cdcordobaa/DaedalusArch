import type { Guest } from './Guest';
import type { GuestId } from './value-objects/GuestId';

export interface GuestRepository {
  nextId(): GuestId;
  byId(id: GuestId): Guest | undefined;
  save(guest: Guest): void;
}
