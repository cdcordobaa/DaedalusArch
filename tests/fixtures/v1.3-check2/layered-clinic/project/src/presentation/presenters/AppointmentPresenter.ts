import { Appointment } from '../../business/entities/Appointment';

export interface AppointmentView {
  id: string;
  start: string;
  end: string;
  status: string;
}

export function present(a: Appointment): AppointmentView {
  return { id: a.id, start: a.startsAt.toISOString(), end: a.endsAt().toISOString(), status: a.status };
}
