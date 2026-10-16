import { Household } from '../domain/household';
import { InventoryItem } from '../domain/inventory';
import { Pickup, SlotBooking } from '../domain/pickup';
import { DonatedProduct } from '../domain/donation';

export interface HouseholdRepository {
  save(h: Household): void;
  get(id: string): Household | undefined;
  list(): Household[];
}

export interface InventoryRepository {
  save(item: InventoryItem): void;
  get(id: string): InventoryItem | undefined;
  list(): InventoryItem[];
}

export interface BookingRepository {
  save(b: SlotBooking): void;
  forHousehold(householdId: string): SlotBooking | undefined;
  inSlot(weekday: number, hour: number): SlotBooking[];
  remove(householdId: string): void;
}

export interface PickupRepository {
  save(p: Pickup): void;
  list(): Pickup[];
}

export interface DonationFeed {
  /** Products donated on the given day (YYYY-MM-DD). */
  donatedOn(date: string): Promise<DonatedProduct[]>;
}

export interface CategoryMappingRepository {
  set(productCode: string, category: string): void;
  categoryFor(productCode: string): string | undefined;
  all(): Record<string, string>;
}

export interface ImportLog {
  has(key: string): boolean;
  add(key: string): void;
}
