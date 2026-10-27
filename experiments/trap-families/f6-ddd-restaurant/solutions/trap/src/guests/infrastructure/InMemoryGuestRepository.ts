import { Guest, type GuestState } from '../domain/guest/Guest';
import type { GuestRepository } from '../domain/guest/GuestRepository';
import { GuestId } from '../domain/guest/value-objects/GuestId';

export class InMemoryGuestRepository implements GuestRepository {
  private readonly rows = new Map<string, GuestState>();
  private sequence = 0;

  nextId(): GuestId {
    this.sequence += 1;
    return GuestId.of(`G-${String(this.sequence).padStart(4, '0')}`);
  }

  byId(id: GuestId): Guest | undefined {
    const row = this.rows.get(id.value);
    return row === undefined ? undefined : Guest.restore(row);
  }

  save(guest: Guest): void {
    this.rows.set(guest.id.value, guest.state());
  }
}
