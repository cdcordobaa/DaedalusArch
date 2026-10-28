import { openLicensingDesk } from './licensing';
import { InMemoryVendorStore } from './licensing/infrastructure/InMemoryVendorStore';
import { LicensingGateway } from './market/acl/LicensingGateway';
import { checkInVendor, reportNoShow } from './market/application/attendance';
import { bookPitch, type BookingConfirmation } from './market/application/bookPitch';
import { openMarketDay, type PitchLayout } from './market/application/marketDays';
import { NoticeCourier } from './market/application/NoticeCourier';
import { PitchPlan } from './market/application/PitchPlan';
import type { NoShowReported } from './market/domain/day/events/NoShowReported';
import type { VendorCheckedIn } from './market/domain/day/events/VendorCheckedIn';
import { InMemoryMarketDayStore } from './market/infrastructure/InMemoryMarketDayStore';

/** Composition root. Each market command hands on the notices it stored before it returns. */
export function createApp() {
  const vendors = new InMemoryVendorStore();
  const licensing = openLicensingDesk(vendors);
  const days = new InMemoryMarketDayStore();
  const courier = new NoticeCourier(days);
  const gateway = new LicensingGateway(licensing);
  const plan = new PitchPlan(vendors, days);

  courier.subscribe('VendorCheckedIn', (n) => {
    const arrived = n as VendorCheckedIn;
    licensing.vendorTraded(arrived.vendorId, arrived.date);
  });

  // A reported no-show strikes the licence exactly like a manager's strike, before the report command returns.
  courier.subscribe('NoShowReported', (n) => {
    licensing.strike((n as NoShowReported).vendorId);
  });

  const marketCommand = <T>(run: () => T): T => {
    const result = run();
    courier.deliverPendingNotices();
    return result;
  };

  return {
    registerVendor: (tradingName: string): string => licensing.register(tradingName),
    recordInspection: (vendorId: string, score: number): void => licensing.inspect(vendorId, score),
    issueStrike: (vendorId: string): void => licensing.strike(vendorId),
    licence: (vendorId: string) => licensing.sheet(vendorId),
    openDay: (date: string, pitches: PitchLayout[]): void => marketCommand(() => openMarketDay(days, date, pitches)),
    book: (date: string, pitch: string, vendorId: string): BookingConfirmation => marketCommand(() => bookPitch(days, gateway, date, pitch, vendorId)),
    checkIn: (date: string, vendorId: string): void => marketCommand(() => checkInVendor(days, date, vendorId)),
    reportNoShow: (date: string, pitch: string): void => marketCommand(() => reportNoShow(days, date, pitch)),
    pitchPlan: (date: string): string[] => plan.linesFor(date),
  };
}
