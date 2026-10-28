export interface CancelAppointmentCommand {
  appointmentId: string;
  now: Date;
}

export interface CancelAppointmentPort {
  execute(command: CancelAppointmentCommand): Promise<void>;
}
