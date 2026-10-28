import type { Appointment } from '../../../domain/appointment';

export interface BookAppointmentCommand {
  petId: string;
  ownerId: string;
  startsAt: Date;
}

export interface BookAppointmentPort {
  execute(command: BookAppointmentCommand): Promise<Appointment>;
}
