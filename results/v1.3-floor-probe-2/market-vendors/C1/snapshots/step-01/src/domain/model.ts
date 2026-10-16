export class RuleViolation extends Error {}
export class NotFoundError extends Error {}

export interface MarketDay { id: string; date: string }
export interface Pitch { id: string; number: number; size: 'small' | 'medium' | 'large'; power: boolean }
export interface Vendor { id: string; name: string; contact: string; products: string[] }
export interface Booking { id: string; dayId: string; pitchId: string; vendorId: string }
export interface ReaderLink { readerId: string; dayId: string; vendorId: string }
export interface Sale { id: string; vendorId: string; dayId: string; readerId: string; amount: number; time: string }

export function checkBooking(dayBookings: Booking[], pitchId: string, vendorId: string): void {
  if (dayBookings.some((b) => b.pitchId === pitchId)) throw new RuleViolation('pitch already booked for that day');
  if (dayBookings.some((b) => b.vendorId === vendorId)) throw new RuleViolation('vendor already has a pitch that day');
}
