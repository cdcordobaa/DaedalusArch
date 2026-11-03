import { BookTourPort } from '../../../application/ports/in/book-tour.port';
import { BookTourParamsDto, BookTourResponseDto } from './booking.dto';

export class BookingController {
  constructor(private readonly bookTour: BookTourPort) {}

  async postBook(params: BookTourParamsDto): Promise<BookTourResponseDto> {
    const result = await this.bookTour.book({ bookingId: params.bookingId });
    return { bookingId: result.bookingId, status: result.status };
  }
}
