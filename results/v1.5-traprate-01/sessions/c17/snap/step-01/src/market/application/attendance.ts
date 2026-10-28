import type { MarketDayRepository } from '../domain/day/MarketDayRepository';
import { dayOf } from './marketDays';

/** The vendor arrived and set up on their pitch. */
export function checkInVendor(days: MarketDayRepository, date: string, vendorId: string): void {
  const day = dayOf(days, date);
  day.checkIn(vendorId);
  days.store(day);
}

/** The market warden reports a booked pitch left empty. */
export function reportNoShow(days: MarketDayRepository, date: string, pitchCode: string): void {
  const day = dayOf(days, date);
  day.reportNoShow(pitchCode);
  days.store(day);
}
