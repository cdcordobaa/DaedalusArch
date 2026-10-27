import type { GuestProfile } from '../contracts/GuestProfile';
import type { GuestRepository } from '../domain/guest/GuestRepository';
import { GuestId } from '../domain/guest/value-objects/GuestId';

export class GetGuestProfile {
  constructor(private readonly guests: GuestRepository) {}

  execute(guestId: string): GuestProfile | undefined {
    const guest = this.guests.byId(GuestId.of(guestId));
    if (guest === undefined) return undefined;
    return { guestId: guest.id.value, name: guest.name, visits: guest.visits, status: guest.status() };
  }
}
