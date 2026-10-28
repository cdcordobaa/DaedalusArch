import type { MarketDayRepository } from '../domain/day/MarketDayRepository';
import { dayOf } from './marketDays';
import type { LicenceRegister } from './ports/LicenceRegister';

export interface BookingConfirmation {
  readonly ref: string;
  readonly pitch: string;
  readonly fee: number;
}

export function bookPitch(days: MarketDayRepository, licences: LicenceRegister, date: string, pitchCode: string, vendorId: string): BookingConfirmation {
  const status = licences.statusOf(vendorId);
  if (status === undefined) throw new Error(`no vendor ${vendorId}`);
  if (status === 'suspended') throw new Error(`vendor ${vendorId} is suspended`);
  const day = dayOf(days, date);
  if (day.pitch(pitchCode).kind === 'hall' && status !== 'full') throw new Error(`pitch ${pitchCode} needs a full licence`);
  const ref = days.issueRef();
  const pitch = day.book(ref, pitchCode, vendorId);
  days.store(day);
  return { ref, pitch: pitch.code, fee: pitch.fee() };
}
