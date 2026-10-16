import { Booking, DomainError, Vendor } from '../../domain/entities/market';
import { BookingRepository, MarketRepository, VendorRepository } from '../../domain/repositories';
import { assertCanBook } from '../../domain/services/booking-rules';
import { Clock, IdGenerator, Transaction } from '../ports';
import { AuditLog } from './audit';
import { CANCEL_FREE_HOURS } from '../../domain/services/settlement';

export interface RegisterVendorDto { businessName: string; contact: string; products: string[] }

export class VendorUseCases {
  constructor(
    private readonly market: MarketRepository,
    private readonly vendors: VendorRepository,
    private readonly bookings: BookingRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly audit: AuditLog,
    private readonly tx: Transaction,
  ) {}

  register(dto: RegisterVendorDto): Vendor {
    const v = { id: this.ids.next('ven'), ...dto };
    this.vendors.save(v);
    return v;
  }

  list(): Vendor[] { return this.vendors.list(); }

  book(vendorId: string, marketDayId: string, pitchId: string, actor: string): Booking {
    if (!this.vendors.get(vendorId)) throw new DomainError('unknown vendor');
    const day = this.market.day(marketDayId);
    if (!day) throw new DomainError('unknown market day');
    if (day.status === 'settled') throw new DomainError('market day is settled');
    if (!this.market.pitch(pitchId)) throw new DomainError('unknown pitch');
    assertCanBook(this.bookings.forDay(marketDayId).filter((x) => x.status === 'active'), pitchId, vendorId);
    const b: Booking = { id: this.ids.next('bk'), vendorId, marketDayId, pitchId, status: 'active', feeDue: true };
    this.tx.run(() => {
      this.bookings.save(b);
      this.audit.record(actor, 'booking', b.id, null, b, marketDayId);
    });
    return b;
  }

  cancel(bookingId: string, actor: string): Booking {
    const b = this.bookings.get(bookingId);
    if (!b || b.status !== 'active') throw new DomainError('no active booking');
    const day = this.market.day(b.marketDayId);
    if (!day || day.status === 'settled') throw new DomainError('market day is settled');
    const hoursBefore = (new Date(`${day.date}T00:00:00Z`).getTime() - this.clock.now().getTime()) / 3_600_000;
    const cancelled: Booking = { ...b, status: 'cancelled', feeDue: hoursBefore < CANCEL_FREE_HOURS };
    this.tx.run(() => {
      this.bookings.save(cancelled);
      this.audit.record(actor, 'booking', b.id, b, cancelled, b.marketDayId);
    });
    return cancelled;
  }
}
