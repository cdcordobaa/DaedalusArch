export interface AppointmentRecord {
  id: string;
  patientId: string;
  practitionerId: string;
  startsAt: Date;
  minutes: number;
  status: string;
}

export interface PractitionerRecord {
  id: string;
  fullName: string;
  specialty: string;
  dailyCapacity: number;
}
