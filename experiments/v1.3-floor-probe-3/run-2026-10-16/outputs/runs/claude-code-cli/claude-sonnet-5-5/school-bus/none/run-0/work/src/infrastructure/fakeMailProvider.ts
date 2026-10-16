import type { MailMessage, MailProvider, NotificationLedger } from "../application/ports.js";

/** Fake provider: records messages instead of sending them. */
export class FakeMailProvider implements MailProvider {
  readonly sent: MailMessage[] = [];
  send(message: MailMessage): void { this.sent.push({ ...message }); }
}

export class InMemoryNotificationLedger implements NotificationLedger {
  private readonly delays = new Map<string, number>();
  private readonly cancelled = new Set<string>();
  private readonly absences = new Set<string>();
  lastDelayNotified(tripKey: string, email: string): number | undefined { return this.delays.get(`${tripKey}|${email}`); }
  recordDelayNotified(tripKey: string, email: string, delayMinutes: number): void { this.delays.set(`${tripKey}|${email}`, delayMinutes); }
  isCancelled(tripKey: string): boolean { return this.cancelled.has(tripKey); }
  markCancelled(tripKey: string): void { this.cancelled.add(tripKey); }
  isAbsenceReported(tripKey: string): boolean { return this.absences.has(tripKey); }
  markAbsenceReported(tripKey: string): void { this.absences.add(tripKey); }
}
