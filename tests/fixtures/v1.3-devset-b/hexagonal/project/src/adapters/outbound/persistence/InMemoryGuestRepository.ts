import { GuestRepository } from '../../../application/ports/out/GuestRepository';
import { Guest } from '../../../domain/model/Guest';

export class InMemoryGuestRepository implements GuestRepository {
  private readonly guests = new Map<string, Guest>([['g-1', new Guest('g-1', 'Alistair', 'alistair@example.org')]]);

  async findById(id: string): Promise<Guest | undefined> {
    return this.guests.get(id);
  }
}
