import { Vendor } from '../domain/vendor/Vendor';
import type { VendorRepository } from '../domain/vendor/VendorRepository';
import { VendorId } from '../domain/vendor/value-objects/VendorId';

const load = (vendors: VendorRepository, vendorId: string): Vendor => {
  const vendor = vendors.find(VendorId.of(vendorId));
  if (vendor === undefined) throw new Error(`no vendor ${vendorId}`);
  return vendor;
};

export function registerVendor(vendors: VendorRepository, tradingName: string): string {
  const vendor = Vendor.register(vendors.allocateId(), tradingName);
  vendors.put(vendor);
  return vendor.id.value;
}

/** The council inspector's visit. */
export function recordInspection(vendors: VendorRepository, vendorId: string, score: number): void {
  const vendor = load(vendors, vendorId);
  vendor.recordInspection(score);
  vendors.put(vendor);
}

/** The market manager gives a strike by hand. */
export function issueStrike(vendors: VendorRepository, vendorId: string): void {
  const vendor = load(vendors, vendorId);
  vendor.addStrike();
  vendors.put(vendor);
}

/** Reaction to a reported no-show: the strike follows the stored report. */
export function recordNoShow(vendors: VendorRepository, vendorId: string, bookingRef: string): void {
  const vendor = load(vendors, vendorId);
  vendor.strikeForNoShow(bookingRef);
  vendors.put(vendor);
}

/** Reaction to a vendor checking in at a pitch: keeps the licence's last trading date. */
export function recordTradingDay(vendors: VendorRepository, vendorId: string, date: string): void {
  const vendor = load(vendors, vendorId);
  vendor.noteTrading(date);
  vendors.put(vendor);
}
