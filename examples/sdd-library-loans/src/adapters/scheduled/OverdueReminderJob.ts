import type { Clock } from '../../application/ports/Clock';
import type { SendOverdueRemindersUseCase } from '../../application/reminders/SendOverdueRemindersUseCase';

/** Time-driven inbound adapter: a scheduler calls runOnce() once a day. */
export class OverdueReminderJob {
  constructor(
    private readonly sendReminders: SendOverdueRemindersUseCase,
    private readonly clock: Clock,
  ) {}

  async runOnce(): Promise<string[]> {
    return this.sendReminders.execute(this.clock.now());
  }
}
