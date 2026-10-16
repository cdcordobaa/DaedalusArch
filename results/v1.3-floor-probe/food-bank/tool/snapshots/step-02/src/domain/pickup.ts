export const SLOT_CAPACITY = 12;

export interface SlotBooking {
  householdId: string;
  weekday: number; // 1 = Monday ... 7 = Sunday
  hour: number;
}

export interface PickupLine {
  itemId: string;
  name: string;
  category: string;
  quantity: number;
}

export interface Pickup {
  id: string;
  householdId: string;
  date: string;
  lines: PickupLine[];
}

export function slotKey(weekday: number, hour: number): string {
  return `${weekday}@${hour}`;
}

export function validateSlot(weekday: number, hour: number): void {
  if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) throw new Error('weekday must be 1..7');
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) throw new Error('hour must be 0..23');
}
