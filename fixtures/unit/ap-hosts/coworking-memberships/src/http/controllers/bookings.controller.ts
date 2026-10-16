import { Request, Response } from 'express';
import { DeskBookingsService } from '../../services/desk-bookings.service';
import { RoomBookingsService } from '../../services/room-bookings.service';
import { bookDeskRequest, bookRoomRequest } from '../requests';

export class BookingsController {
  constructor(
    private readonly desks: DeskBookingsService,
    private readonly rooms: RoomBookingsService,
  ) {}

  async bookDesk(req: Request, res: Response): Promise<void> {
    const input = bookDeskRequest(req.body);
    const booking = await this.desks.book(input.memberId, input.deskId, input.date, input.half);
    res.status(201).json(booking);
  }

  async cancelDesk(req: Request, res: Response): Promise<void> {
    await this.desks.cancel(req.params.bookingId, req.params.memberId);
    res.status(204).end();
  }

  async desksOn(req: Request, res: Response): Promise<void> {
    res.json(await this.desks.forDay(req.params.date));
  }

  async bookRoom(req: Request, res: Response): Promise<void> {
    const input = bookRoomRequest(req.body);
    const booking = await this.rooms.book(req.params.roomId, input.memberId, input.startsAt, input.minutes, input.attendees);
    res.status(201).json(booking);
  }

  async cancelRoom(req: Request, res: Response): Promise<void> {
    await this.rooms.cancel(req.params.bookingId);
    res.status(204).end();
  }

  async roomSchedule(req: Request, res: Response): Promise<void> {
    res.json(await this.rooms.forRoom(req.params.roomId));
  }
}
