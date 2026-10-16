import { Fixer, Item, RepairEvent } from "../../domain/model";
import { DoorMessage, EventRepository, FixerRepository, ItemRepository, VenueSmsStore } from "../../application/ports";

export class InMemoryEventRepository implements EventRepository {
  private readonly data = new Map<string, RepairEvent>();
  async save(event: RepairEvent): Promise<void> { this.data.set(event.id, event); }
  async findById(id: string): Promise<RepairEvent | undefined> { return this.data.get(id); }
  async list(): Promise<RepairEvent[]> { return [...this.data.values()]; }
}

export class InMemoryFixerRepository implements FixerRepository {
  private readonly data = new Map<string, Fixer>();
  async save(fixer: Fixer): Promise<void> { this.data.set(fixer.id, fixer); }
  async findById(id: string): Promise<Fixer | undefined> { return this.data.get(id); }
  async listByEvent(eventId: string): Promise<Fixer[]> {
    return [...this.data.values()].filter((f) => f.eventId === eventId);
  }
}

export class InMemoryVenueSmsStore implements VenueSmsStore {
  private readonly disabled = new Set<string>();
  private readonly board = new Map<string, DoorMessage[]>();
  private key(venue: string): string { return venue.trim().toLowerCase(); }
  async isEnabled(venue: string): Promise<boolean> { return !this.disabled.has(this.key(venue)); }
  async setEnabled(venue: string, enabled: boolean): Promise<void> {
    if (enabled) this.disabled.delete(this.key(venue));
    else this.disabled.add(this.key(venue));
  }
  async addDoorMessage(venue: string, message: DoorMessage): Promise<void> {
    const k = this.key(venue);
    this.board.set(k, [...(this.board.get(k) ?? []), message]);
  }
  async listDoorMessages(venue: string): Promise<DoorMessage[]> { return this.board.get(this.key(venue)) ?? []; }
}

export class InMemoryItemRepository implements ItemRepository {
  private readonly data = new Map<number, Item>();
  private counter = 0;
  async nextTicketNumber(): Promise<number> { return ++this.counter; }
  async save(item: Item): Promise<void> { this.data.set(item.ticketNumber, item); }
  async findByTicket(n: number): Promise<Item | undefined> { return this.data.get(n); }
  async listByEvent(eventId: string): Promise<Item[]> {
    return [...this.data.values()].filter((i) => i.eventId === eventId);
  }
  async findByPartOrderNumber(orderNumber: string): Promise<Item | undefined> {
    return [...this.data.values()].find((i) => i.partOrder?.orderNumber === orderNumber);
  }
}
