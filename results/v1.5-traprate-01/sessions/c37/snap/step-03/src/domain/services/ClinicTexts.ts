import type { Appointment } from '../model/Appointment';

/** The wording of the texts the clinic sends its patients. */
export class ClinicTexts {
  confirmation(a: Appointment): string {
    return `Northside Clinic: your appointment is booked for ${a.day} at ${a.time}.`;
  }

  reminder(a: Appointment): string {
    return `Northside Clinic: reminder of your appointment on ${a.day} at ${a.time}. Reply STOP to opt out.`;
  }
}
