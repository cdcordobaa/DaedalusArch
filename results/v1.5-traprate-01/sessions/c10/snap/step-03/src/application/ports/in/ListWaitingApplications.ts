export interface WaitingApplication {
  readonly application: string;
  readonly pet: string;
  readonly adopter: string;
  readonly waitingDays: number;
}

export interface ListWaitingApplications {
  /** Pending applications, longest waiting first; equal waits in application id order. */
  waitingList(): WaitingApplication[];
}
