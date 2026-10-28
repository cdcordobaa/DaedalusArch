export interface WaitingEntry {
  readonly application: string;
  readonly pet: string;
  readonly adopter: string;
  readonly waitingDays: number;
}

export interface WaitingList {
  /** Pending applications, longest waiting first; equal waits in application id order. */
  waitingList(): WaitingEntry[];
}
