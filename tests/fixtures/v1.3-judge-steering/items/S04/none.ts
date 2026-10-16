import { AppointmentDao } from '../../persistence/AppointmentDao';
import { PatientDao } from '../../persistence/PatientDao';
import { Appointment, AppointmentStatus } from '../entities/Appointment';
import { Patient } from '../entities/Patient';
import { Practitioner } from '../entities/Practitioner';
import { SchedulingError } from '../errors/SchedulingError';

export class SchedulingService {
  private next = 1;

  constructor(
    private readonly patients: PatientDao,
    private readonly appointments: AppointmentDao,
  ) {}

  async book(patientId: string, practitionerId: string, startsAt: Date, minutes: number): Promise<Appointment> {
    const p = await this.patients.get(patientId);
    if (p === null) throw new SchedulingError('unknown', `Unknown patient ${patientId}`);
    const patient = new Patient(p.id, p.fullName, p.birthYear, p.blocked);
    if (patient.blocked) throw new SchedulingError('rejected', `${patient.fullName} cannot book online`);

    const pr = await this.appointments.practitioner(practitionerId);
    if (pr === null) throw new SchedulingError('unknown', `Unknown practitioner ${practitionerId}`);
    const practitioner = new Practitioner(pr.id, pr.fullName, pr.specialty, pr.dailyCapacity);
    if (patient.isMinor(startsAt.getFullYear()) && !practitioner.treatsMinors()) {
      throw new SchedulingError('rejected', `${practitioner.fullName} does not see minors`);
    }

    const candidate = new Appointment(`apt-${this.next++}`, patientId, practitionerId, startsAt, minutes, 'booked');
    const sameDay = (await this.appointments.forPractitioner(practitionerId))
      .map((a) => new Appointment(a.id, a.patientId, a.practitionerId, a.startsAt, a.minutes, a.status as AppointmentStatus))
      .filter((a) => a.startsAt.toDateString() === startsAt.toDateString());
    if (sameDay.length >= practitioner.dailyCapacity) throw new SchedulingError('clash', 'The practitioner is fully booked that day');
    if (sameDay.some((a) => a.overlaps(candidate))) throw new SchedulingError('clash', 'The slot is taken');

    await this.appointments.add({ ...candidate });
    return candidate;
  }

  async cancel(appointmentId: string, now: Date): Promise<Appointment> {
    const a = await this.appointments.get(appointmentId);
    if (a === null) throw new SchedulingError('unknown', `Unknown appointment ${appointmentId}`);
    const appointment = new Appointment(a.id, a.patientId, a.practitionerId, a.startsAt, a.minutes, a.status as AppointmentStatus);
    appointment.cancel(now);
    await this.appointments.setStatus(appointment.id, appointment.status);
    return appointment;
  }
}
