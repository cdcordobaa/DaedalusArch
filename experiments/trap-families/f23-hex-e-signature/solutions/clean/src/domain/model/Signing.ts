/** How long a signing link stays open, and the reminder rhythm while it is open. */
export const SIGNING_LINK_DAYS = 14;
const REMINDER_GAP_MS = 3 * 24 * 3600 * 1000;
const MAX_REMINDERS = 2;

/** One sending of an agreement for signature: the signature service's reference, when it went out, reminders so far. */
export class Signing {
  private constructor(
    readonly ref: string,
    readonly sentAt: Date,
    private readonly remindedAt: readonly Date[],
  ) {}

  static started(ref: string, sentAt: Date): Signing {
    return new Signing(ref, sentAt, []);
  }

  expiresAt(): Date {
    return new Date(this.sentAt.getTime() + SIGNING_LINK_DAYS * 24 * 3600 * 1000);
  }

  /** At most two reminders, the first 3 days after sending, each later one 3 days after the previous; none once the link expired. */
  isReminderDue(now: Date): boolean {
    if (this.remindedAt.length >= MAX_REMINDERS) return false;
    if (now.getTime() >= this.expiresAt().getTime()) return false;
    const last = this.remindedAt.at(-1) ?? this.sentAt;
    return now.getTime() - last.getTime() >= REMINDER_GAP_MS;
  }

  reminded(at: Date): Signing {
    return new Signing(this.ref, this.sentAt, [...this.remindedAt, at]);
  }
}
