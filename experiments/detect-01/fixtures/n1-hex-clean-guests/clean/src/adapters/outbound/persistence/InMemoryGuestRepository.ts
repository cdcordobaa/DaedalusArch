import { Guest } from '../../../domain/model/Guest';
import type { GuestRepository } from '../../../application/ports/out/GuestRepository';

export class InMemoryGuestRepository implements GuestRepository {
  private readonly rows = new Map<string, Guest>();
  private seq = 0;

  async byEmail(email: string): Promise<Guest | undefined> {
    return [...this.rows.values()].find((g) => g.email === email);
  }

  async save(guest: Guest): Promise<void> {
    this.rows.set(guest.id, guest);
  }

  nextId(): string {
    this.seq += 1;
    return `g-${this.seq}`;
  }
}
