import { randomUUID } from 'node:crypto';
import { Booking, BusinessError, FeeSchedule, MarketDay, Pitch, PitchSize, Vendor } from './models';
import { auditService } from './audit-service';
import { inTransaction } from '../persistence/transaction';
import { bookingRepository, feeRepository, marketDayRepository, pitchRepository, vendorRepository } from '../persistence/repositories';

const SIZES: PitchSize[] = ['small', 'medium', 'large'];

export const marketService = {
  defineMarketDay(date: string): MarketDay {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new BusinessError('date must be YYYY-MM-DD');
    if (marketDayRepository.findByDate(date)) throw new BusinessError('market day already exists');
    return marketDayRepository.save({ id: randomUUID(), date, status: 'open' });
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

  book(actor: string, vendorId: string, marketDayId: string, pitchNumber: number): Booking {
    if (!vendorRepository.find(vendorId)) throw new BusinessError('unknown vendor', 404);
    const day = marketDayRepository.find(marketDayId);
    if (!day) throw new BusinessError('unknown market day', 404);
    if (day.status !== 'open') throw new BusinessError('market day is closed for booking changes', 409);
    if (!pitchRepository.find(pitchNumber)) throw new BusinessError('unknown pitch', 404);
    const dayBookings = bookingRepository.activeForDay(marketDayId);
    if (dayBookings.some((b) => b.pitchNumber === pitchNumber)) throw new BusinessError('pitch already booked for this market day', 409);
    if (dayBookings.some((b) => b.vendorId === vendorId)) throw new BusinessError('vendor already holds a pitch on this market day', 409);
    return inTransaction(() => {
      const booking = bookingRepository.save({ id: randomUUID(), vendorId, marketDayId, pitchNumber, feeDue: true });
      auditService.record(actor, 'booking', booking.id, { marketDayId, vendorId }, null, booking);
      return booking;
    });
  },

  cancelBooking(actor: string, bookingId: string, now: Date = new Date()): Booking {
    const booking = bookingRepository.find(bookingId);
    if (!booking) throw new BusinessError('unknown booking', 404);
    if (booking.cancelledAt) throw new BusinessError('booking already cancelled', 409);
    const day = marketDayRepository.find(booking.marketDayId);
    if (!day || day.status === 'settled') throw new BusinessError('market day is settled', 409);
    const hoursBefore = (new Date(`${day.date}T00:00:00Z`).getTime() - now.getTime()) / 3600000;
    return inTransaction(() => {
      const cancelled = bookingRepository.save({ ...booking, cancelledAt: now.toISOString(), feeDue: hoursBefore < 48 });
      auditService.record(actor, 'booking', booking.id, { marketDayId: booking.marketDayId, vendorId: booking.vendorId }, booking, cancelled);
      return cancelled;
    });
  },

  setCommissionRate(actor: string, vendorId: string, rate: number): Vendor {
    const v = vendorRepository.find(vendorId);
    if (!v) throw new BusinessError('unknown vendor', 404);
    if (!(rate >= 0 && rate < 1)) throw new BusinessError('rate must be between 0 and 1');
    return inTransaction(() => {
      const updated = vendorRepository.save({ ...v, commissionRate: rate });
      auditService.record(actor, 'commission-rate', vendorId, { vendorId }, v.commissionRate ?? null, rate);
      return updated;
    });
  },

  getFees(): FeeSchedule {
    return feeRepository.get();
  },

  updateFees(actor: string, patch: Partial<FeeSchedule>): FeeSchedule {
    const before: FeeSchedule = JSON.parse(JSON.stringify(feeRepository.get())) as FeeSchedule;
    if (patch.defaultCommissionRate !== undefined && !(patch.defaultCommissionRate >= 0 && patch.defaultCommissionRate < 1)) {
      throw new BusinessError('defaultCommissionRate must be between 0 and 1');
    }
    return inTransaction(() => {
      const after = feeRepository.update(patch);
      auditService.record(actor, 'fees', 'fee-schedule', {}, before, { ...after });
      return after;
    });
  },

  bookingsForDay(marketDayId: string): Booking[] {
    return bookingRepository.forDay(marketDayId);
  },
};
