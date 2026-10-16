import type { ReminderLog } from '../../../application/ports/ReminderLog';

export class InMemoryReminderLog implements ReminderLog {
  private readonly last = new Map<string, Date>();

  async lastSent(loanId: string): Promise<Date | undefined> {
    return this.last.get(loanId);
  }

  async record(loanId: string, at: Date): Promise<void> {
    this.last.set(loanId, at);
  }
}
