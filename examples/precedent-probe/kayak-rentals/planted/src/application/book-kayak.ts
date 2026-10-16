import { randomUUID } from 'node:crypto';
import { isActive, overlaps, type Booking } from '../domain/booking';
import type { BookingRepository } from '../domain/booking-repository';
import { DEPOSIT_CENTS } from '../domain/kayak';
import type { KayakRepository } from '../domain/kayak-repository';
import { PaddlePayClient } from '../infrastructure/payments/paddle-pay-client';

export interface BookingRequest {
  readonly kayakId: string;
  readonly customerName: string;
  readonly customerEmail: string;
  readonly startsAt: Date;
  readonly endsAt: Date;
}

export class BookKayak {
  constructor(
    private readonly kayaks: KayakRepository,
    private readonly bookings: BookingRepository,
    private readonly payments: PaddlePayClient,
  ) {}

  async execute(req: BookingRequest): Promise<Booking> {
    if (req.endsAt <= req.startsAt) throw new Error('a booking must end after it starts');
    const kayak = await this.kayaks.findById(req.kayakId);
    if (kayak === undefined) throw new Error(`unknown kayak ${req.kayakId}`);
    const taken = (await this.bookings.findByKayak(kayak.id)).filter(isActive).some((b) => overlaps(b, req));
    if (taken) throw new Error(`${kayak.name} is already booked at that time`);
    const booking: Booking = { id: randomUUID(), ...req, status: 'booked' };
    const deposit = await this.payments.charge(req.customerEmail, DEPOSIT_CENTS[kayak.type], `deposit ${booking.id}`);
    booking.depositPaymentId = deposit.paymentId;
    await this.bookings.save(booking);
    return booking;
  }
}
