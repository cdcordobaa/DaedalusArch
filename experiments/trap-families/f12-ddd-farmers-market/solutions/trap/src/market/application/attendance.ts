import type { VendorRepository } from '../../licensing/domain/vendor/VendorRepository';
import { VendorId } from '../../licensing/domain/vendor/value-objects/VendorId';
import type { MarketDayRepository } from '../domain/day/MarketDayRepository';
import { dayOf } from './marketDays';

/** The vendor arrived and set up on their pitch. */
export function checkInVendor(days: MarketDayRepository, date: string, vendorId: string): void {
  const day = dayOf(days, date);
  day.checkIn(vendorId);
  days.store(day);
}

/** The market warden reports a booked pitch left empty. */
export function reportNoShow(days: MarketDayRepository, date: string, pitchCode: string, vendors: VendorRepository): void {
  const day = dayOf(days, date);
  day.reportNoShow(pitchCode);
  days.store(day);
  const booking = day.plan().find((b) => b.pitch === pitchCode);
  const vendor = booking === undefined ? undefined : vendors.find(VendorId.of(booking.vendorId));
  if (vendor !== undefined) {
    vendor.addStrike();
    vendors.put(vendor);
  }
}
