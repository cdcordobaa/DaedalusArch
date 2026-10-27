import { ScheduleService } from '../../application/ScheduleService';
import { DoctorDayRepository } from '../../domain/doctorday/DoctorDayRepository';

export interface BookRequest { doctorId: string; date: string; patientId: string; start: number; end: number }

export class BookingController {
  constructor(private service: ScheduleService, private days: DoctorDayRepository) {}

  handle(req: BookRequest): { status: number; body: string } {
    const todays = this.days.find(req.doctorId, req.date)?.list() ?? [];
    const overlapping = todays.filter((a) => !(a.end <= req.start || a.start >= req.end));
    if (overlapping.length > 0) {
      return { status: 409, body: 'doctor is busy' };
    }
    try {
      const a = this.service.book(req.doctorId, req.date, req.patientId, req.start, req.end);
      return { status: 201, body: a.id };
    } catch (e) {
      return { status: 400, body: String(e) };
    }
  }
}
