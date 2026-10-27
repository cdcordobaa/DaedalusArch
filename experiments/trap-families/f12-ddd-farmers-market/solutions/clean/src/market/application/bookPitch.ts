import type { MarketDayRepository } from '../domain/day/MarketDayRepository';
import { dayOf } from './marketDays';
import type { LicenceRegister } from './ports/LicenceRegister';

export interface BookingConfirmation {
  readonly ref: string;
  readonly pitch: string;
  readonly fee: number;
}

export function bookPitch(days: MarketDayRepository, licences: LicenceRegister, date: string, pitchCode: string, vendorId: string): BookingConfirmation {
  if (!licences.isRegistered(vendorId)) throw new Error(`no vendor ${vendorId}`);
  const day = dayOf(days, date);
  const ref = days.issueRef();
  const pitch = day.book(ref, pitchCode, vendorId, licences.standingOf(vendorId));
  days.store(day);
  return { ref, pitch: pitch.code, fee: pitch.fee() };
}
