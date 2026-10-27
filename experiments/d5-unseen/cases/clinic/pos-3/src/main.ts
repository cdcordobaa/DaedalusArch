import { ScheduleService } from './scheduling/application/ScheduleService';
import { BookingController } from './scheduling/infrastructure/http/BookingController';
import { InMemoryAppointmentRepository, InMemoryDoctorDayRepository } from './scheduling/infrastructure/InMemoryClinicRepository';

const days = new InMemoryDoctorDayRepository();
const appts = new InMemoryAppointmentRepository();
const service = new ScheduleService(days, appts);
export const controller = new BookingController(service, days);
