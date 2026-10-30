import { CheckInPort } from '../../../application/ports/in/check-in.port';

export class CheckInKiosk {
  constructor(private readonly checkIn: CheckInPort) {}

  async scan(bookingCode: string): Promise<string> {
    const bookingId = bookingCode.trim();
    await this.checkIn.checkIn({ bookingId });
    return `checked in ${bookingId}`;
  }
}
