import { Household } from '../../domain/household';
import { InventoryItem } from '../../domain/inventory';
import { Pickup, SlotBooking } from '../../domain/pickup';
import { BookingRepository, HouseholdRepository, InventoryRepository, PickupRepository } from '../../application/ports';

export class MemoryHouseholdRepository implements HouseholdRepository {
  private readonly data = new Map<string, Household>();
  save(h: Household): void {
    this.data.set(h.id, h);
  }
  get(id: string): Household | undefined {
    return this.data.get(id);
  }
  list(): Household[] {
    return [...this.data.values()];
  }
}

export class MemoryInventoryRepository implements InventoryRepository {
  private readonly data = new Map<string, InventoryItem>();
  save(item: InventoryItem): void {
    this.data.set(item.id, item);
  }
  get(id: string): InventoryItem | undefined {
    return this.data.get(id);
  }
  list(): InventoryItem[] {
    return [...this.data.values()];
  }
}

export class MemoryBookingRepository implements BookingRepository {
  private readonly data = new Map<string, SlotBooking>();
  save(b: SlotBooking): void {
    this.data.set(b.householdId, b);
  }
  forHousehold(householdId: string): SlotBooking | undefined {
    return this.data.get(householdId);
  }
  inSlot(weekday: number, hour: number): SlotBooking[] {
    return [...this.data.values()].filter((b) => b.weekday === weekday && b.hour === hour);
  }
  remove(householdId: string): void {
    this.data.delete(householdId);
  }
}

export class MemoryPickupRepository implements PickupRepository {
  private readonly data: Pickup[] = [];
  save(p: Pickup): void {
    this.data.push(p);
  }
  list(): Pickup[] {
    return [...this.data];
  }
}
