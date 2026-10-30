import { CheckInPort } from '../../../application/ports/in/check-in.port';
import { parseBookingCode } from './booking-code';

export class CheckInKiosk {
  constructor(private readonly checkIn: CheckInPort) {}

  async scan(bookingCode: string): Promise<string> {
    const bookingId = parseBookingCode(bookingCode);
    await this.checkIn.checkIn({ bookingId });
    return `checked in ${bookingId}`;
  }
}
