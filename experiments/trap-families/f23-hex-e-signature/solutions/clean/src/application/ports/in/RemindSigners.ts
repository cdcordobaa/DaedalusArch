export interface RemindSigners {
  /** Sends the reminders due at `now`; answers the reminded agreements' ids in drafting order. */
  sendReminders(now: Date): Promise<string[]>;
}
