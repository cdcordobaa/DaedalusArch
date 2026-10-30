import { BookShipmentPort } from '../../../application/ports/in/book-shipment.port';

export interface BookShipmentParamsDto {
  readonly bookingId: string;
}

export interface BookShipmentResponseDto {
  readonly bookingId: string;
  readonly status: string;
  readonly charge: string;
}

export class BookingController {
  constructor(private readonly bookShipment: BookShipmentPort) {}

  async post(params: BookShipmentParamsDto): Promise<BookShipmentResponseDto> {
    const result = await this.bookShipment.book({ bookingId: params.bookingId });
    return { bookingId: result.bookingId, status: result.status, charge: (result.chargeCents / 100).toFixed(2) };
  }
}
