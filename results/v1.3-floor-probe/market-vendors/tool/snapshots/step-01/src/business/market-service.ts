import { randomUUID } from 'node:crypto';
import { Booking, BusinessError, MarketDay, Pitch, PitchSize, Vendor } from './models';
import { bookingRepository, marketDayRepository, pitchRepository, vendorRepository } from '../persistence/repositories';

const SIZES: PitchSize[] = ['small', 'medium', 'large'];

export const marketService = {
  defineMarketDay(date: string): MarketDay {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new BusinessError('date must be YYYY-MM-DD');
    if (marketDayRepository.findByDate(date)) throw new BusinessError('market day already exists');
    return marketDayRepository.save({ id: randomUUID(), date });
  },

  listMarketDays(): MarketDay[] {
    return marketDayRepository.all();
  },

  definePitch(number: number, size: PitchSize, hasPower: boolean): Pitch {
    if (!SIZES.includes(size)) throw new BusinessError(`size must be one of ${SIZES.join(', ')}`);
    if (pitchRepository.find(number)) throw new BusinessError(`pitch ${number} already exists`);
    return pitchRepository.save({ number, size, hasPower });
  },

  listPitches(): Pitch[] {
    return pitchRepository.all();
  },

  registerVendor(businessName: string, contact: string, products: string[]): Vendor {
    if (!businessName || !contact) throw new BusinessError('businessName and contact are required');
    return vendorRepository.save({ id: randomUUID(), businessName, contact, products: products ?? [] });
  },

  listVendors(): Vendor[] {
    return vendorRepository.all();
  },

  book(vendorId: string, marketDayId: string, pitchNumber: number): Booking {
    if (!vendorRepository.find(vendorId)) throw new BusinessError('unknown vendor', 404);
    if (!marketDayRepository.find(marketDayId)) throw new BusinessError('unknown market day', 404);
    if (!pitchRepository.find(pitchNumber)) throw new BusinessError('unknown pitch', 404);
    const dayBookings = bookingRepository.forDay(marketDayId);
    if (dayBookings.some((b) => b.pitchNumber === pitchNumber)) throw new BusinessError('pitch already booked for this market day', 409);
    if (dayBookings.some((b) => b.vendorId === vendorId)) throw new BusinessError('vendor already holds a pitch on this market day', 409);
    return bookingRepository.save({ id: randomUUID(), vendorId, marketDayId, pitchNumber });
  },

  bookingsForDay(marketDayId: string): Booking[] {
    return bookingRepository.forDay(marketDayId);
  },
};
