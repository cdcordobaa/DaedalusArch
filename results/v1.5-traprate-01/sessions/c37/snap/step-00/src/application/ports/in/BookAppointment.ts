export interface AppointmentRequest {
  readonly patientName: string;
  readonly phone: string;
  readonly day: string;
  readonly time: string;
}

export interface BookingView {
  readonly appointmentId: string;
  readonly confirmation: string;
}

export interface BookAppointment {
  book(request: AppointmentRequest): Promise<BookingView>;
}
