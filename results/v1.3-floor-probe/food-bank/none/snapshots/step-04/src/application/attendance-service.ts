import { MAX_MISSED_IN_ROW, isoWeekday } from '../domain/pickup';
import { BookingRepository, HouseholdRepository, Mailer, PickupRepository, SmsSender } from './ports';

export class AttendanceService {
  constructor(
    private readonly households: HouseholdRepository,
    private readonly bookings: BookingRepository,
    private readonly pickups: PickupRepository,
    private readonly sms: SmsSender,
    private readonly mailer: Mailer,
    private readonly staffOnDuty: () => string[],
  ) {}

  /** Sends SMS reminders to households with a pickup tomorrow (run in the evening). */
  async sendReminders(tomorrow: string): Promise<number> {
    const weekday = isoWeekday(tomorrow);
    let sent = 0;
    for (const b of this.bookings.all().filter((x) => x.weekday === weekday)) {
      const h = this.households.get(b.householdId);
      if (!h || !h.smsReminder || !h.phone) continue;
      await this.sms.send(h.phone, `Food bank reminder: your pickup is tomorrow (${tomorrow}) at ${b.hour}:00.`);
      sent++;
    }
    return sent;
  }

  /** Called after a pickup day: counts misses and cancels bookings after three in a row. */
  checkMissedPickups(date: string): string[] {
    const weekday = isoWeekday(date);
    const pickedUp = new Set(this.pickups.list().filter((p) => p.date === date).map((p) => p.householdId));
    const cancelled: string[] = [];
    for (const b of this.bookings.all().filter((x) => x.weekday === weekday)) {
      if (pickedUp.has(b.householdId)) continue;
      const missed = (b.missedInRow ?? 0) + 1;
      if (missed >= MAX_MISSED_IN_ROW) {
        this.bookings.remove(b.householdId);
        cancelled.push(b.householdId);
        const h = this.households.get(b.householdId);
        for (const to of this.staffOnDuty()) {
          this.mailer.send(
            to,
            `Pickup booking cancelled: ${h?.name ?? b.householdId}`,
            `${h?.name ?? b.householdId} missed ${missed} pickups in a row; their slot (day ${b.weekday}, ${b.hour}:00) was cancelled.`,
          );
        }
      } else {
        this.bookings.save({ ...b, missedInRow: missed });
      }
    }
    return cancelled;
  }
}
