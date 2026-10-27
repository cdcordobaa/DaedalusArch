export interface ReminderResult {
  readonly appointmentId: string;
  readonly status: string;
}

/** One line of the front desk's list for a day. */
export interface ReminderLine {
  readonly appointmentId: string;
  readonly patientName: string;
  readonly phone: string;
  readonly time: string;
  readonly reminder: string;
  /** The front desk phones the patient because the reminder did not reach them. */
  readonly callPatient: boolean;
}

export interface SendReminders {
  /** Sends the reminders for the appointments on a day that have not had one yet. */
  sendFor(day: string): Promise<ReminderResult[]>;
  /** The front desk's list for a day, in booking order. */
  reportFor(day: string): Promise<ReminderLine[]>;
}
