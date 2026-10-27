import { licenceSheet } from './application/licenceSheet';
import { issueStrike, recordInspection, recordTradingDay, registerVendor } from './application/vendorRecords';
import type { VendorRepository } from './domain/vendor/VendorRepository';
import { InMemoryVendorStore } from './infrastructure/InMemoryVendorStore';
import type { LicenceSheet } from './published/LicenceSheet';

export type { LicenceSheet } from './published/LicenceSheet';

/** The licensing office's counter: everything the rest of the market may ask or tell it. */
export interface LicensingDesk {
  register(tradingName: string): string;
  inspect(vendorId: string, score: number): void;
  strike(vendorId: string): void;
  sheet(vendorId: string): LicenceSheet | undefined;
  /** Subscriber: a vendor checked in at a pitch on this date. */
  vendorTraded(vendorId: string, date: string): void;
}

export function openLicensingDesk(vendors: VendorRepository = new InMemoryVendorStore()): LicensingDesk {
  return {
    register: (name) => registerVendor(vendors, name),
    inspect: (vendorId, score) => recordInspection(vendors, vendorId, score),
    strike: (vendorId) => issueStrike(vendors, vendorId),
    sheet: (vendorId) => licenceSheet(vendors, vendorId),
    vendorTraded: (vendorId, date) => recordTradingDay(vendors, vendorId, date),
  };
}
