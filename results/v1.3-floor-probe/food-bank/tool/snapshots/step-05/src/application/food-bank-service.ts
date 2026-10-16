import { randomUUID } from 'node:crypto';
import { DietaryNeed, Household, conflictingNeed } from '../domain/household';
import { InventoryItem, takeFrom } from '../domain/inventory';
import { Pickup, PickupLine, SLOT_CAPACITY, SlotBooking, validateSlot } from '../domain/pickup';
import { BookingRepository, HouseholdRepository, InventoryRepository, PickupRepository } from './ports';

export class FoodBankService {
  constructor(
    private readonly households: HouseholdRepository,
    private readonly inventory: InventoryRepository,
    private readonly bookings: BookingRepository,
    private readonly pickups: PickupRepository,
    private readonly today: () => string = () => new Date().toISOString().slice(0, 10),
  ) {}

  registerHousehold(input: {
    name: string;
    postcode: string;
    people: number;
    dietaryNeeds?: DietaryNeed[];
    phone?: string;
    smsReminder?: boolean;
  }): Household {
    if (!input.name || !input.postcode) throw new Error('name and postcode are required');
    if (!(input.people > 0)) throw new Error('people must be at least 1');
    const h: Household = {
      id: randomUUID(),
      name: input.name,
      postcode: input.postcode,
      people: input.people,
      dietaryNeeds: input.dietaryNeeds ?? [],
      phone: input.phone,
      smsReminder: !!input.smsReminder && !!input.phone,
    };
    this.households.save(h);
    return h;
  }

  listHouseholds(): Household[] {
    return this.households.list();
  }

  addItem(input: { name: string; category: string; quantity: number; bestBefore: string }): InventoryItem {
    if (!(input.quantity > 0)) throw new Error('quantity must be positive');
    const item: InventoryItem = { id: randomUUID(), ...input };
    this.inventory.save(item);
    return item;
  }

  listInventory(): InventoryItem[] {
    return this.inventory.list();
  }

  bookSlot(householdId: string, weekday: number, hour: number): SlotBooking {
    if (!this.households.get(householdId)) throw new Error('Unknown household');
    validateSlot(weekday, hour);
    const taken = this.bookings.inSlot(weekday, hour).filter((b) => b.householdId !== householdId);
    if (taken.length >= SLOT_CAPACITY) throw new Error('This slot is full');
    const booking: SlotBooking = { householdId, weekday, hour };
    this.bookings.save(booking);
    return booking;
  }

  setReminderPreference(householdId: string, smsReminder: boolean, phone?: string): Household {
    const h = this.households.get(householdId);
    if (!h) throw new Error('Unknown household');
    const updated: Household = { ...h, phone: phone ?? h.phone, smsReminder };
    if (updated.smsReminder && !updated.phone) throw new Error('A phone number is needed for SMS reminders');
    this.households.save(updated);
    return updated;
  }

  recordPickup(householdId: string, items: { itemId: string; quantity: number }[]): Pickup {
    const household = this.households.get(householdId);
    if (!household) throw new Error('Unknown household');
    const today = this.today();
    // validate everything first so that a bad line changes nothing
    const updates: InventoryItem[] = [];
    const lines: PickupLine[] = [];
    for (const line of items) {
      const item = this.inventory.get(line.itemId);
      if (!item) throw new Error(`Unknown item ${line.itemId}`);
      const need = conflictingNeed(household, item.category);
      if (need) throw new Error(`${item.name} (${item.category}) conflicts with the household's dietary need: ${need}`);
      updates.push(takeFrom(item, line.quantity, today));
      lines.push({ itemId: item.id, name: item.name, category: item.category, quantity: line.quantity });
    }
    updates.forEach((u) => this.inventory.save(u));
    const pickup: Pickup = { id: randomUUID(), householdId, date: today, lines };
    this.pickups.save(pickup);
    const booking = this.bookings.forHousehold(householdId);
    if (booking && booking.missedInRow) this.bookings.save({ ...booking, missedInRow: 0 });
    return pickup;
  }
}

