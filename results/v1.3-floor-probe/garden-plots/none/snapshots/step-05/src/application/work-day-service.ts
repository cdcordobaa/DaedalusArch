import { randomUUID } from 'node:crypto';
import { WorkDay } from '../domain/work-day';
import { Clock, GardenerRepository, Mailer, WorkDayRepository } from './ports';
import { layoutEmail } from './email-layout';

export class WorkDayService {
  constructor(
    private readonly workDays: WorkDayRepository,
    private readonly gardeners: GardenerRepository,
    private readonly mailer: Mailer,
    private readonly clock: Clock,
  ) {}

  schedule(date: string, description: string): WorkDay {
    const d: WorkDay = { id: randomUUID(), date, description, signedUp: [], present: [] };
    this.workDays.save(d);
    return d;
  }

  list(): WorkDay[] {
    return this.workDays.all();
  }

  signUp(workDayId: string, gardenerId: string): WorkDay {
    const d = this.get(workDayId);
    if (!this.gardeners.find(gardenerId)) throw new Error('Unknown gardener');
    if (!d.signedUp.includes(gardenerId)) d.signedUp.push(gardenerId);
    this.workDays.save(d);
    return d;
  }

  markPresent(workDayId: string, gardenerId: string): WorkDay {
    const d = this.get(workDayId);
    if (!d.present.includes(gardenerId)) d.present.push(gardenerId);
    this.workDays.save(d);
    return d;
  }

  /** Sends the reminder for tomorrow's work days. */
  sendReminders(): number {
    const tomorrow = new Date(this.clock.now().getTime() + 24 * 3600 * 1000).toISOString().slice(0, 10);
    let sent = 0;
    for (const d of this.workDays.all().filter((w) => w.date === tomorrow)) {
      for (const id of d.signedUp) {
        const g = this.gardeners.find(id);
        if (!g) continue;
        const mail = layoutEmail(g.name, 'Work day tomorrow', [
          `This is a reminder that you signed up for the work day tomorrow (${d.date}): ${d.description}.`,
        ]);
        this.mailer.send(g.email, mail.subject, mail.body);
        sent++;
      }
    }
    return sent;
  }

  private get(id: string): WorkDay {
    const d = this.workDays.find(id);
    if (!d) throw new Error(`Work day ${id} not found`);
    return d;
  }
}
