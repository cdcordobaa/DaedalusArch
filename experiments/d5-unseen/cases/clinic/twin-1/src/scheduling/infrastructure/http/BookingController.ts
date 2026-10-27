import { ScheduleService } from '../../application/ScheduleService';

export interface BookRequest { doctorId: string; date: string; patientId: string; start: number; end: number }

export class BookingController {
  constructor(private service: ScheduleService) {}

  handle(req: BookRequest): { status: number; body: string } {
    try {
      const a = this.service.book(req.doctorId, req.date, req.patientId, req.start, req.end);
      return { status: 201, body: a.id };
    } catch (e) {
      return { status: 400, body: String(e) };
    }
  }
}
