export interface BookAppointmentRequestDto {
  petId?: string;
  ownerId?: string;
  startsAt?: string;
}

export interface CancelAppointmentRequestDto {
  appointmentId?: string;
}

export interface SubmitClaimRequestDto {
  invoiceId?: string;
  policyNumber?: string;
}

export interface HttpResponse {
  status: number;
  body: Record<string, unknown>;
}
