import type { Notifier } from '../ports/Notifier';
import type { ReminderLog } from '../ports/ReminderLog';
import type { OverdueReportUseCase } from '../reporting/OverdueReportUseCase';

export const REMIND_EVERY_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Sends one reminder per overdue loan, at most once every REMIND_EVERY_DAYS days. Returns the loans reminded. */
export class SendOverdueRemindersUseCase {
  constructor(
    private readonly overdueReport: OverdueReportUseCase,
    private readonly notifier: Notifier,
    private readonly log: ReminderLog,
  ) {}

  async execute(at: Date): Promise<string[]> {
    const sent: string[] = [];
    for (const line of await this.overdueReport.execute(at)) {
      const last = await this.log.lastSent(line.loanId);
      if (last !== undefined && at.getTime() - last.getTime() < REMIND_EVERY_DAYS * DAY_MS) continue;
      await this.notifier.send(
        line.memberEmail,
        `Overdue: ${line.title}`,
        `Dear ${line.memberName}, "${line.title}" was due on ${line.dueAt.toISOString().slice(0, 10)} and is ${String(line.daysLate)} day(s) late. Please return it.`,
      );
      await this.log.record(line.loanId, at);
      sent.push(line.loanId);
    }
    return sent;
  }
}
