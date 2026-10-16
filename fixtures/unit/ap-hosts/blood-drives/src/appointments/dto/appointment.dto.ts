import { AppointmentDocument } from '../../persistence/schemas/appointment.schema';

export class BookAppointmentDto {
  donorId!: string;
  startsAt!: string;
}

export class CancelAppointmentDto {
  reason!: string;
}

export interface AppointmentView {
  readonly id: string;
  readonly driveId: string;
  readonly donorId: string;
  readonly startsAt: string;
  readonly status: string;
}

export function toAppointmentView(a: AppointmentDocument): AppointmentView {
  return { id: a.id, driveId: a.driveId, donorId: a.donorId, startsAt: a.startsAt.toISOString(), status: a.status };
}
