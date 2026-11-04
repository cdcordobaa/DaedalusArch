import { Haul } from '../domain/haul/Haul';
import { HaulRepository } from '../domain/haul/HaulRepository';

export class DuplicateTicketError extends Error {
  constructor(ticketNo: string) {
    super(`weighbridge ticket ${ticketNo} is already booked to a haul`);
  }
}

export class InMemoryHaulRepository implements HaulRepository {
  private readonly rows = new Map<string, Haul>();
  private readonly tickets = new Map<string, string>();

  async findByTruckAndShift(truckId: string, shiftDate: string): Promise<Haul[]> {
    return [...this.rows.values()].filter((h) => h.truckId === truckId && h.shiftDate === shiftDate);
  }

  async save(haul: Haul): Promise<void> {
    const owner = this.tickets.get(haul.ticketNo);
    if (owner !== undefined && owner !== haul.id) throw new DuplicateTicketError(haul.ticketNo);
    this.tickets.set(haul.ticketNo, haul.id);
    this.rows.set(haul.id, haul);
  }
}
