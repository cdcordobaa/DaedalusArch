import { Household } from '../domain/household';
import { InventoryItem } from '../domain/inventory';
import { Pickup, SlotBooking } from '../domain/pickup';

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
